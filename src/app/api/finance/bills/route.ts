import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { vendorBills, vendorBillLines } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const bills = await tdb.select().from(vendorBills).orderBy(desc(vendorBills.billDate));
  return NextResponse.json({ bills });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    billDate, dueDate, supplierName, supplierId, billType,
    poId, grnId, shipmentId, lcId,
    currency, exchangeRate, lines, notes,
    supplierInvoiceNo, supplierInvoiceDate,
  } = body;

  if (!supplierName || !billType || !lines?.length) {
    return NextResponse.json({ error: 'Supplier, bill type, and at least one line required' }, { status: 400 });
  }

  const tdb = await getTenantDb(session.user.tenantSlug);

  const year = new Date().getFullYear();
  const count = await tdb.$count(vendorBills);
  const billNo = `BILL-${year}-${String(count + 1).padStart(4, '0')}`;

  const exRate = parseFloat(exchangeRate ?? '1') || 1;
  const subtotal = lines.reduce((s: number, l: any) => s + parseFloat(l.amount ?? '0'), 0);
  const taxAmount = lines.reduce((s: number, l: any) => s + parseFloat(l.taxAmount ?? '0'), 0);
  const totalAmount = subtotal + taxAmount;
  const totalAmountPkr = currency === 'PKR' ? totalAmount : totalAmount * exRate;

  const [bill] = await tdb.insert(vendorBills).values({
    billNo,
    billDate: billDate ?? new Date().toISOString().split('T')[0],
    dueDate: dueDate || null,
    supplierName,
    supplierId: supplierId || null,
    billType,
    poId: poId || null,
    grnId: grnId || null,
    shipmentId: shipmentId || null,
    lcId: lcId || null,
    currency: currency ?? 'PKR',
    exchangeRate: String(exRate),
    subtotal: String(subtotal),
    taxAmount: String(taxAmount),
    totalAmount: String(totalAmount),
    totalAmountPkr: String(totalAmountPkr),
    balanceDue: String(totalAmountPkr),
    notes: notes || null,
    supplierInvoiceNo: supplierInvoiceNo || null,
    supplierInvoiceDate: supplierInvoiceDate || null,
    status: 'draft',
    createdById: session.user.id as any,
  }).returning();

  await tdb.insert(vendorBillLines).values(
    lines.map((l: any, i: number) => ({
      billId: bill.id,
      description: l.description,
      accountCode: l.accountCode || null,
      quantity: String(l.quantity ?? '1'),
      unitPrice: l.unitPrice ? String(l.unitPrice) : null,
      amount: String(l.amount),
      taxPct: String(l.taxPct ?? '0'),
      taxAmount: String(l.taxAmount ?? '0'),
      totalAmount: String(parseFloat(l.amount ?? '0') + parseFloat(l.taxAmount ?? '0')),
      sortOrder: i,
    }))
  );

  return NextResponse.json({ bill }, { status: 201 });
}
