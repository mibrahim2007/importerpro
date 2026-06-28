import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  salesInvoices, salesInvoiceLines, invoicePayments, customers,
  salesOrders, dispatchChallans, products,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[invoice], lines, payments] = await Promise.all([
    tdb.select({
      ...salesInvoices, customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerStrn: customers.strn,
      customerBillingAddress: customers.billingAddress, customerCity: customers.city,
      customerWhtPct: customers.whtRatePct,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(eq(salesInvoices.id, id)).limit(1),

    tdb.select({
      ...salesInvoiceLines,
      productName: products.name, productCode: products.code,
    })
    .from(salesInvoiceLines)
    .leftJoin(products, eq(products.id, salesInvoiceLines.productId))
    .where(eq(salesInvoiceLines.invoiceId, id))
    .orderBy(salesInvoiceLines.sortOrder),

    tdb.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, id))
      .orderBy(invoicePayments.paymentDate),
  ]);

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...invoice, lines, payments });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();
  const { action } = body;

  const [current] = await tdb.select().from(salesInvoices).where(eq(salesInvoices.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'post') {
    if (current.status !== 'draft') return NextResponse.json({ error: 'Can only post a draft invoice' }, { status: 400 });
    const [updated] = await tdb.update(salesInvoices)
      .set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() })
      .where(eq(salesInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'send') {
    if (current.status !== 'posted') return NextResponse.json({ error: 'Invoice must be posted before sending' }, { status: 400 });
    const [updated] = await tdb.update(salesInvoices)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(salesInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'record_payment') {
    const { paymentDate, amountPkr, paymentMethod = 'bank_transfer', referenceNo, notes } = body;
    if (!paymentDate || !amountPkr) return NextResponse.json({ error: 'paymentDate and amountPkr required' }, { status: 400 });
    const disallowed = ['draft', 'cancelled'];
    if (disallowed.includes(current.status ?? '')) return NextResponse.json({ error: 'Cannot record payment on this invoice' }, { status: 400 });

    await tdb.insert(invoicePayments).values({
      invoiceId: id, paymentDate, amountPkr: String(amountPkr),
      paymentMethod, referenceNo: referenceNo ?? null, notes: notes ?? null,
    });

    // Recalculate total received
    const [{ total }] = await tdb.select({ total: sql<string>`COALESCE(SUM(amount_pkr), 0)` })
      .from(invoicePayments).where(eq(invoicePayments.invoiceId, id));
    const received = parseFloat(total);
    const grandTotal = parseFloat(String(current.grandTotalPkr ?? '0'));
    const balance = grandTotal - received;
    const newStatus = balance <= 0 ? 'fully_paid' : received > 0 ? 'partially_paid' : current.status!;

    const [updated] = await tdb.update(salesInvoices).set({
      amountReceivedPkr: String(received.toFixed(2)),
      balancePkr: String(Math.max(0, balance).toFixed(2)),
      status: newStatus as any,
      updatedAt: new Date(),
    }).where(eq(salesInvoices.id, id)).returning();

    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    const { reason } = body;
    const cancelable = ['draft', 'posted', 'sent'];
    if (!cancelable.includes(current.status ?? '')) return NextResponse.json({ error: 'Cannot cancel this invoice' }, { status: 400 });
    const [updated] = await tdb.update(salesInvoices).set({
      status: 'cancelled', cancellationReason: reason ?? null,
      cancelledAt: new Date(), updatedAt: new Date(),
    }).where(eq(salesInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
