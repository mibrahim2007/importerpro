import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { vendorBills, vendorBillLines, suppliers } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: vendorBills.id,
      billNo: vendorBills.billNo,
      billDate: vendorBills.billDate,
      praId: vendorBills.praId,
      linkedBillId: vendorBills.linkedBillId,
      debitApplicationType: vendorBills.debitApplicationType,
      status: vendorBills.status,
      currency: vendorBills.currency,
      totalAmount: vendorBills.totalAmount,
      totalAmountPkr: vendorBills.totalAmountPkr,
      balanceDue: vendorBills.balanceDue,
      createdAt: vendorBills.createdAt,
      supplierName: suppliers.name,
    })
    .from(vendorBills)
    .leftJoin(suppliers, eq(suppliers.id, vendorBills.supplierId))
    .where(eq(vendorBills.billType, 'debit_note'))
    .orderBy(desc(vendorBills.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { lines = [], ...header } = body;

  // Auto DN-YYYY-NNNN
  const year = new Date().getFullYear();
  const [{ count }] = await tdb
    .select({ count: sql<number>`count(*)::int` })
    .from(vendorBills)
    .where(sql`bill_type = 'debit_note' AND EXTRACT(YEAR FROM created_at) = ${year}`);
  const billNo = `DN-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  // Compute totals
  const subtotal = lines.reduce((s: number, l: any) =>
    s + parseFloat(String(l.amount ?? 0)), 0);
  const taxAmount = lines.reduce((s: number, l: any) =>
    s + parseFloat(String(l.taxAmount ?? 0)), 0);
  const totalAmount = subtotal + taxAmount;
  const exchangeRate = parseFloat(String(header.exchangeRate ?? 1));
  const totalAmountPkr = totalAmount * (header.currency !== 'PKR' ? exchangeRate : 1);

  const supplierRow = header.supplierId
    ? await tdb.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, header.supplierId)).limit(1)
    : [];
  const supplierName = supplierRow[0]?.name ?? header.supplierName ?? '';

  const [dn] = await tdb.insert(vendorBills).values({
    billNo,
    billDate: header.billDate,
    dueDate: header.dueDate || null,
    supplierId: header.supplierId || null,
    supplierName,
    billType: 'debit_note',
    poId: header.poId || null,
    praId: header.praId || null,
    linkedBillId: header.linkedBillId || null,
    debitApplicationType: header.debitApplicationType ?? 'applied_to_bill',
    currency: header.currency ?? 'USD',
    exchangeRate: String(exchangeRate),
    subtotal: String(subtotal),
    taxAmount: String(taxAmount),
    totalAmount: String(totalAmount),
    totalAmountPkr: String(totalAmountPkr),
    totalPaid: '0',
    balanceDue: String(totalAmountPkr),
    status: 'draft',
    notes: header.notes || null,
    supplierInvoiceNo: header.supplierInvoiceNo || null,
    createdById: session.user.id,
  }).returning();

  if (lines.length > 0) {
    await tdb.insert(vendorBillLines).values(
      lines.map((l: any, i: number) => ({
        billId: dn.id,
        description: l.description,
        accountCode: l.accountCode || null,
        quantity: String(l.quantity ?? 1),
        unitPrice: l.unitPrice ? String(l.unitPrice) : null,
        amount: String(l.amount ?? 0),
        taxPct: String(l.taxPct ?? 0),
        taxAmount: String(l.taxAmount ?? 0),
        totalAmount: String(parseFloat(String(l.amount ?? 0)) + parseFloat(String(l.taxAmount ?? 0))),
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(dn, { status: 201 });
}
