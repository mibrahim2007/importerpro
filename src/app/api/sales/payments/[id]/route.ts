import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { customerReceipts, receiptAllocations, salesInvoices, customers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[receipt], allocations] = await Promise.all([
    tdb.select({
      ...customerReceipts,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerBillingAddress: customers.billingAddress,
    })
    .from(customerReceipts)
    .leftJoin(customers, eq(customers.id, customerReceipts.customerId))
    .where(eq(customerReceipts.id, id)).limit(1),

    tdb.select({
      id: receiptAllocations.id,
      invoiceId: receiptAllocations.invoiceId,
      allocatedAmountPkr: receiptAllocations.allocatedAmountPkr,
      allocatedAt: receiptAllocations.allocatedAt,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      grandTotalPkr: salesInvoices.grandTotalPkr,
      balancePkr: salesInvoices.balancePkr,
    })
    .from(receiptAllocations)
    .leftJoin(salesInvoices, eq(salesInvoices.id, receiptAllocations.invoiceId))
    .where(eq(receiptAllocations.receiptId, id)),
  ]);

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...receipt, allocations });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();
  const { action } = body;

  const [current] = await tdb.select().from(customerReceipts).where(eq(customerReceipts.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'clear_pdc') {
    // PDC cheque cleared — now apply allocations to invoices
    if (current.status !== 'pending') return NextResponse.json({ error: 'Only pending PDCs can be cleared' }, { status: 400 });

    const allocations = await tdb.select().from(receiptAllocations).where(eq(receiptAllocations.receiptId, id));
    for (const alloc of allocations) {
      const amount = parseFloat(String(alloc.allocatedAmountPkr));
      const [inv] = await tdb.select({ amountReceivedPkr: salesInvoices.amountReceivedPkr, grandTotalPkr: salesInvoices.grandTotalPkr })
        .from(salesInvoices).where(eq(salesInvoices.id, alloc.invoiceId)).limit(1);
      if (inv) {
        const newReceived = parseFloat(String(inv.amountReceivedPkr ?? '0')) + amount;
        const balance = Math.max(0, parseFloat(String(inv.grandTotalPkr ?? '0')) - newReceived);
        await tdb.update(salesInvoices).set({
          amountReceivedPkr: String(newReceived.toFixed(2)),
          balancePkr: String(balance.toFixed(2)),
          status: balance <= 0 ? 'fully_paid' : 'partially_paid' as any,
          updatedAt: new Date(),
        }).where(eq(salesInvoices.id, alloc.invoiceId));
      }
    }

    const [updated] = await tdb.update(customerReceipts).set({ status: 'cleared', updatedAt: new Date() })
      .where(eq(customerReceipts.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'bounce') {
    if (current.status !== 'pending') return NextResponse.json({ error: 'Only pending cheques can be bounced' }, { status: 400 });
    const [updated] = await tdb.update(customerReceipts).set({
      status: 'bounced', bouncedReason: body.reason ?? null, updatedAt: new Date(),
    }).where(eq(customerReceipts.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    if (current.status === 'bounced' || current.status === 'cancelled')
      return NextResponse.json({ error: 'Already cancelled/bounced' }, { status: 400 });

    // Reverse invoice payments for cleared receipts
    if (current.status === 'cleared') {
      const allocations = await tdb.select().from(receiptAllocations).where(eq(receiptAllocations.receiptId, id));
      for (const alloc of allocations) {
        const amount = parseFloat(String(alloc.allocatedAmountPkr));
        const [inv] = await tdb.select({ amountReceivedPkr: salesInvoices.amountReceivedPkr, grandTotalPkr: salesInvoices.grandTotalPkr, status: salesInvoices.status })
          .from(salesInvoices).where(eq(salesInvoices.id, alloc.invoiceId)).limit(1);
        if (inv && inv.status !== 'cancelled') {
          const newReceived = Math.max(0, parseFloat(String(inv.amountReceivedPkr ?? '0')) - amount);
          const balance = parseFloat(String(inv.grandTotalPkr ?? '0')) - newReceived;
          const newStatus = newReceived <= 0 ? 'sent' : 'partially_paid';
          await tdb.update(salesInvoices).set({
            amountReceivedPkr: String(newReceived.toFixed(2)),
            balancePkr: String(balance.toFixed(2)),
            status: newStatus as any, updatedAt: new Date(),
          }).where(eq(salesInvoices.id, alloc.invoiceId));
        }
      }
    }

    const [updated] = await tdb.update(customerReceipts).set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(customerReceipts.id, id)).returning();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
