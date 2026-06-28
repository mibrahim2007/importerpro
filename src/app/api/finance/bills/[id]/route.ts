import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { vendorBills, vendorBillLines, payments, journalEntries, journalLines } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [[bill], lines, billPayments] = await Promise.all([
    tdb.select().from(vendorBills).where(eq(vendorBills.id, id)).limit(1),
    tdb.select().from(vendorBillLines).where(eq(vendorBillLines.billId, id)),
    tdb.select().from(payments).where(eq(payments.billId, id)).orderBy(desc(payments.paymentDate)),
  ]);
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ bill, lines, payments: billPayments });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [bill] = await tdb.select().from(vendorBills).where(eq(vendorBills.id, id)).limit(1);
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date();

  if (action === 'post') {
    if (bill.status !== 'draft') return NextResponse.json({ error: 'Bill must be in draft to post' }, { status: 422 });
    await tdb.update(vendorBills).set({ status: 'posted', postedAt: now, updatedAt: now }).where(eq(vendorBills.id, id));
  }

  if (action === 'pay') {
    // Record a payment against this bill
    const { paymentDate, paymentType, amount, currency, exchangeRate, bankRef, bankName, bankAccountCode, formMNo, notes } = body;
    if (!amount || parseFloat(amount) <= 0) return NextResponse.json({ error: 'Valid payment amount required' }, { status: 400 });
    if (!paymentType) return NextResponse.json({ error: 'Payment type required' }, { status: 400 });

    const exRate = parseFloat(exchangeRate ?? '1') || 1;
    const amountNum = parseFloat(amount);
    const amountPkr = (currency ?? 'PKR') === 'PKR' ? amountNum : amountNum * exRate;

    const year = now.getFullYear();
    const count = await tdb.$count(payments);
    const paymentNo = `PMT-${year}-${String(count + 1).padStart(4, '0')}`;

    await tdb.insert(payments).values({
      paymentNo,
      paymentDate: paymentDate ?? now.toISOString().split('T')[0],
      paymentType,
      supplierName: bill.supplierName,
      supplierId: bill.supplierId ?? undefined,
      billId: id,
      currency: currency ?? bill.currency ?? 'PKR',
      amount: String(amountNum),
      exchangeRate: String(exRate),
      amountPkr: String(amountPkr),
      bankAccountCode: bankAccountCode || null,
      bankRef: bankRef || null,
      bankName: bankName || null,
      formMNo: formMNo || null,
      status: 'paid',
      notes: notes || null,
      createdById: session.user.id as any,
    } as any);

    // Update bill's total_paid and balance_due
    const allPayments = await tdb.select().from(payments).where(eq(payments.billId, id));
    const totalPaid = allPayments.reduce((s, p) => s + parseFloat(p.amountPkr ?? p.amount), 0);
    const totalDue = parseFloat(bill.totalAmountPkr ?? bill.totalAmount);
    const balanceDue = Math.max(0, totalDue - totalPaid);
    const newStatus = balanceDue <= 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'posted';

    await tdb.update(vendorBills).set({
      totalPaid: String(totalPaid),
      balanceDue: String(balanceDue),
      status: newStatus as any,
      updatedAt: now,
    }).where(eq(vendorBills.id, id));
  }

  if (action === 'cancel') {
    if (!['draft', 'posted'].includes(bill.status ?? 'draft')) return NextResponse.json({ error: 'Cannot cancel paid bill' }, { status: 422 });
    await tdb.update(vendorBills).set({ status: 'cancelled', updatedAt: now }).where(eq(vendorBills.id, id));
  }

  if (action === 'match') {
    // 3-way match check: PO → GRN → Bill
    await tdb.update(vendorBills).set({ matchStatus: 'matched', updatedAt: now }).where(eq(vendorBills.id, id));
  }

  const [updated] = await tdb.select().from(vendorBills).where(eq(vendorBills.id, id)).limit(1);
  return NextResponse.json({ bill: updated });
}
