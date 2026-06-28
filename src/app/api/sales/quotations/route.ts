import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesQuotations, salesInquiries, customers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: salesQuotations.id, quotationNo: salesQuotations.quotationNo,
      revisionNo: salesQuotations.revisionNo, date: salesQuotations.date,
      validUntil: salesQuotations.validUntil, status: salesQuotations.status,
      grandTotalPkr: salesQuotations.grandTotalPkr,
      paymentTerms: salesQuotations.paymentTerms, createdAt: salesQuotations.createdAt,
      customerId: salesQuotations.customerId,
      customerName: customers.name, customerCode: customers.code,
    })
    .from(salesQuotations)
    .leftJoin(customers, eq(customers.id, salesQuotations.customerId))
    .orderBy(desc(salesQuotations.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const count = await tdb.$count(salesQuotations);
  const year = new Date().getFullYear();
  const quotationNo = `QT-${year}-${String(count + 1).padStart(4, '0')}`;

  const lines = body.lines ?? [];
  let subtotal = 0;
  let totalTax = 0;

  const lineValues = lines.map((l: any, i: number) => {
    const unitPrice = parseFloat(l.unitPricePkr || '0');
    const discPct = parseFloat(l.discountPct || '0');
    const qty = parseFloat(l.qty || '0');
    const taxPct = parseFloat(l.salesTaxPct ?? '17');
    const netUnit = unitPrice * (1 - discPct / 100);
    const lineTotal = netUnit * qty;
    const lineTax = lineTotal * (taxPct / 100);
    const landedCostRef = parseFloat(l.landedCostRefPkr || '0');
    const marginPct = netUnit > 0 && landedCostRef > 0 ? ((netUnit - landedCostRef) / netUnit) * 100 : null;
    subtotal += lineTotal;
    totalTax += lineTax;
    return {
      productId: l.productId, qty: String(qty), uom: l.uom || null,
      unitPricePkr: String(unitPrice), discountPct: String(discPct),
      netUnitPricePkr: String(netUnit.toFixed(4)),
      totalPkr: String(lineTotal.toFixed(2)),
      salesTaxPct: String(taxPct),
      salesTaxPkr: String(lineTax.toFixed(2)),
      landedCostRefPkr: landedCostRef > 0 ? String(landedCostRef) : null,
      marginPct: marginPct !== null ? String(marginPct.toFixed(4)) : null,
      sortOrder: i,
    };
  });

  const customer = await tdb.select({ whtRatePct: customers.whtRatePct })
    .from(customers).where(eq(customers.id, body.customerId)).limit(1);
  const whtRate = parseFloat(customer[0]?.whtRatePct ?? '4.5') / 100;
  const whtPkr = (subtotal + totalTax) * whtRate;
  const grandTotal = subtotal + totalTax;

  const [quotation] = await tdb.insert(salesQuotations).values({
    quotationNo, revisionNo: 0, date: body.date, validUntil: body.validUntil,
    customerId: body.customerId, inquiryId: body.inquiryId || null,
    paymentTerms: body.paymentTerms || 'net_30',
    deliveryAddressId: body.deliveryAddressId || null,
    status: 'draft',
    termsConditions: body.termsConditions || null,
    internalNotes: body.internalNotes || null,
    subtotalPkr: String(subtotal.toFixed(2)),
    salesTaxPkr: String(totalTax.toFixed(2)),
    whtPkr: String(whtPkr.toFixed(2)),
    grandTotalPkr: String(grandTotal.toFixed(2)),
    createdById: session.user.id,
  }).returning();

  if (lineValues.length) {
    const { salesQuotationLines } = await import('@/db/schema');
    await tdb.insert(salesQuotationLines).values(
      lineValues.map((v: any) => ({ quotationId: quotation.id, ...v }))
    );
  }

  if (body.inquiryId) {
    await tdb.update(salesInquiries)
      .set({ status: 'quoted', linkedQuotationId: quotation.id, updatedAt: new Date() })
      .where(eq(salesInquiries.id, body.inquiryId));
  }

  return NextResponse.json(quotation, { status: 201 });
}
