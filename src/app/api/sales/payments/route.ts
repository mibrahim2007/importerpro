import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { customerReceipts, receiptAllocations, salesInvoices, customers } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb.select({
    id: customerReceipts.id, receiptNo: customerReceipts.receiptNo,
    receiptDate: customerReceipts.receiptDate, status: customerReceipts.status,
    totalAmountPkr: customerReceipts.totalAmountPkr,
    allocatedAmountPkr: customerReceipts.allocatedAmountPkr,
    unallocatedAmountPkr: customerReceipts.unallocatedAmountPkr,
    paymentMethod: customerReceipts.paymentMethod,
    chequeNo: customerReceipts.chequeNo, chequeDueDate: customerReceipts.chequeDueDate,
    bankName: customerReceipts.bankName, referenceNo: customerReceipts.referenceNo,
    createdAt: customerReceipts.createdAt,
    customerName: customers.name, customerId: customerReceipts.customerId,
  })
  .from(customerReceipts)
  .leftJoin(customers, eq(customers.id, customerReceipts.customerId))
  .orderBy(desc(customerReceipts.receiptDate), desc(customerReceipts.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();

  const {
    receiptDate, customerId, totalAmountPkr, paymentMethod = 'bank_transfer',
    bankName, branchCode, chequeNo, chequeDueDate, referenceNo, notes,
    allocations = [], // [{ invoiceId, allocatedAmountPkr }]
  } = body;

  // Auto PR-YYYY-NNNN
  const year = new Date(receiptDate).getFullYear();
  const [{ count }] = await tdb.select({ count: sql<number>`count(*)` }).from(customerReceipts);
  const seq = String(Number(count) + 1).padStart(4, '0');
  const receiptNo = `PR-${year}-${seq}`;

  const totalAmt = parseFloat(String(totalAmountPkr));
  const allocatedAmt = (allocations as any[]).reduce(
    (s: number, a: any) => s + parseFloat(String(a.allocatedAmountPkr || '0')), 0
  );
  const unallocatedAmt = totalAmt - allocatedAmt;

  // PDC starts as 'pending', everything else is 'cleared' by default
  const status = paymentMethod === 'pdc' ? 'pending' : 'cleared';

  const [receipt] = await tdb.insert(customerReceipts).values({
    receiptNo, receiptDate, customerId,
    totalAmountPkr: String(totalAmt.toFixed(2)),
    allocatedAmountPkr: String(allocatedAmt.toFixed(2)),
    unallocatedAmountPkr: String(Math.max(0, unallocatedAmt).toFixed(2)),
    paymentMethod, bankName: bankName ?? null, branchCode: branchCode ?? null,
    chequeNo: chequeNo ?? null, chequeDueDate: chequeDueDate ?? null,
    referenceNo: referenceNo ?? null, notes: notes ?? null,
    status: status as 'cleared' | 'pending',
  }).returning();

  // Only apply allocations if cleared (not PDC pending)
  if (status === 'cleared' && allocations.length > 0) {
    for (const alloc of allocations as { invoiceId: string; allocatedAmountPkr: string }[]) {
      const amount = parseFloat(String(alloc.allocatedAmountPkr));
      if (amount <= 0) continue;

      await tdb.insert(receiptAllocations).values({
        receiptId: receipt.id, invoiceId: alloc.invoiceId,
        allocatedAmountPkr: String(amount.toFixed(2)),
      });

      // Update invoice balance
      const [inv] = await tdb.select({
        amountReceivedPkr: salesInvoices.amountReceivedPkr,
        grandTotalPkr: salesInvoices.grandTotalPkr,
      }).from(salesInvoices).where(eq(salesInvoices.id, alloc.invoiceId)).limit(1);

      if (inv) {
        const newReceived = parseFloat(String(inv.amountReceivedPkr ?? '0')) + amount;
        const grandTotal = parseFloat(String(inv.grandTotalPkr ?? '0'));
        const newBalance = Math.max(0, grandTotal - newReceived);
        const newStatus = newBalance <= 0 ? 'fully_paid' : 'partially_paid';
        await tdb.update(salesInvoices).set({
          amountReceivedPkr: String(newReceived.toFixed(2)),
          balancePkr: String(newBalance.toFixed(2)),
          status: newStatus as any, updatedAt: new Date(),
        }).where(eq(salesInvoices.id, alloc.invoiceId));
      }
    }
  }

  return NextResponse.json(receipt, { status: 201 });
}
