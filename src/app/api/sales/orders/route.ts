import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesOrders, salesOrderLines, customers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: salesOrders.id, soNo: salesOrders.soNo, soDate: salesOrders.soDate,
      status: salesOrders.status, creditCheck: salesOrders.creditCheck,
      grandTotalPkr: salesOrders.grandTotalPkr, paymentTerms: salesOrders.paymentTerms,
      requestedDeliveryDate: salesOrders.requestedDeliveryDate,
      promisedDeliveryDate: salesOrders.promisedDeliveryDate,
      quotationId: salesOrders.quotationId, createdAt: salesOrders.createdAt,
      customerName: customers.name, customerCode: customers.code,
    })
    .from(salesOrders)
    .leftJoin(customers, eq(customers.id, salesOrders.customerId))
    .orderBy(desc(salesOrders.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const count = await tdb.$count(salesOrders);
  const year = new Date().getFullYear();
  const soNo = `SO-${year}-${String(count + 1).padStart(4, '0')}`;

  const lines: any[] = body.lines ?? [];
  let subtotal = 0, totalTax = 0;

  const lineCalcs = lines.map((l: any, i: number) => {
    const unitPrice = parseFloat(l.unitPricePkr || '0');
    const discPct = parseFloat(l.discountPct || '0');
    const qty = parseFloat(l.orderedQty || '0');
    const taxPct = parseFloat(l.salesTaxPct ?? '17');
    const netUnit = unitPrice * (1 - discPct / 100);
    const total = netUnit * qty;
    const tax = total * (taxPct / 100);
    subtotal += total;
    totalTax += tax;
    return { ...l, netUnit, total, tax, i };
  });

  const [custRow] = await tdb.select({ whtRatePct: customers.whtRatePct, creditLimitPkr: customers.creditLimitPkr })
    .from(customers).where(eq(customers.id, body.customerId)).limit(1);
  const whtRate = parseFloat(custRow?.whtRatePct ?? '4.5') / 100;
  const grand = subtotal + totalTax;
  const whtPkr = grand * whtRate;

  const [so] = await tdb.insert(salesOrders).values({
    soNo, soDate: body.soDate, customerId: body.customerId,
    quotationId: body.quotationId || null, paymentTerms: body.paymentTerms || 'net_30',
    deliveryAddressId: body.deliveryAddressId || null,
    requestedDeliveryDate: body.requestedDeliveryDate || null,
    promisedDeliveryDate: body.promisedDeliveryDate || null,
    branchId: body.branchId || null, warehouseId: body.warehouseId || null,
    status: 'draft', internalNotes: body.internalNotes || null,
    subtotalPkr: String(subtotal.toFixed(2)),
    salesTaxPkr: String(totalTax.toFixed(2)),
    whtPkr: String(whtPkr.toFixed(2)),
    grandTotalPkr: String(grand.toFixed(2)),
    creditLimitPkr: custRow?.creditLimitPkr ?? null,
    createdById: session.user.id,
  }).returning();

  if (lineCalcs.length) {
    await tdb.insert(salesOrderLines).values(
      lineCalcs.map((l) => ({
        soId: so.id,
        productId: l.productId,
        orderedQty: String(parseFloat(l.orderedQty || '0')),
        uom: l.uom || null,
        unitPricePkr: String(parseFloat(l.unitPricePkr || '0')),
        discountPct: String(parseFloat(l.discountPct || '0')),
        netUnitPricePkr: String(l.netUnit.toFixed(4)),
        totalPkr: String(l.total.toFixed(2)),
        salesTaxPct: String(parseFloat(l.salesTaxPct ?? '17')),
        salesTaxPkr: String(l.tax.toFixed(2)),
        sortOrder: l.i,
      }))
    );
  }

  return NextResponse.json(so, { status: 201 });
}
