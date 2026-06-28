import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  commercialInvoices, commercialInvoiceLines,
  purchaseOrders, poLines, suppliers, products,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const QTY_VIOLATION = 10;   // >10% qty variance = LC violation
const QTY_MINOR = 3;        // 3-10% = minor
const PRICE_VIOLATION = 5;  // >5% price variance = violation
const PRICE_MINOR = 1;      // 1-5% = minor

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: commercialInvoices.id,
      ciNo: commercialInvoices.ciNo,
      ciDate: commercialInvoices.ciDate,
      poId: commercialInvoices.poId,
      currency: commercialInvoices.currency,
      totalCifValue: commercialInvoices.totalCifValue,
      totalCifPkr: commercialInvoices.totalCifPkr,
      status: commercialInvoices.status,
      matchStatus: commercialInvoices.matchStatus,
      incoterms: commercialInvoices.incoterms,
      createdAt: commercialInvoices.createdAt,
      supplierName: suppliers.name,
      poNo: purchaseOrders.poNo,
    })
    .from(commercialInvoices)
    .leftJoin(suppliers, eq(suppliers.id, commercialInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, commercialInvoices.poId))
    .orderBy(desc(commercialInvoices.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { lines = [], ...header } = body;

  // Load PO lines for variance computation
  const poLineRows = await tdb.select()
    .from(poLines)
    .where(eq(poLines.poId, header.poId));

  const poLineMap = new Map(poLineRows.map((pl) => [pl.id, pl]));

  // Build CI lines with variance computation
  const enrichedLines = lines.map((l: any, i: number) => {
    const qty = parseFloat(l.qty || 0);
    const unitPrice = parseFloat(l.unitPrice || 0);
    const totalValue = qty * unitPrice;
    const poLine = l.poLineId ? poLineMap.get(l.poLineId) : null;

    let qtyVariancePct: number | null = null;
    let priceVariancePct: number | null = null;
    let varianceFlag = 'ok';

    if (poLine) {
      const poQty = parseFloat(String(poLine.qty || 0));
      const poPrice = parseFloat(String(poLine.unitPrice || 0));
      if (poQty > 0) qtyVariancePct = ((qty - poQty) / poQty) * 100;
      if (poPrice > 0) priceVariancePct = ((unitPrice - poPrice) / poPrice) * 100;

      const absQtyVar = Math.abs(qtyVariancePct ?? 0);
      const absPriceVar = Math.abs(priceVariancePct ?? 0);
      if (absQtyVar > QTY_VIOLATION || absPriceVar > PRICE_VIOLATION) varianceFlag = 'violation';
      else if (absQtyVar > QTY_MINOR || absPriceVar > PRICE_MINOR) varianceFlag = 'minor';
    }

    return {
      poLineId: l.poLineId || null,
      productId: l.productId || null,
      hsCode: l.hsCode || null,
      description: l.description,
      qty: String(qty),
      uom: l.uom || null,
      unitPrice: String(unitPrice),
      totalValue: String(totalValue),
      poQty: poLine ? String(parseFloat(String(poLine.qty))) : null,
      poUnitPrice: poLine ? String(parseFloat(String(poLine.unitPriceFob || 0))) : null,
      qtyVariancePct: qtyVariancePct !== null ? String(Math.round(qtyVariancePct * 100) / 100) : null,
      priceVariancePct: priceVariancePct !== null ? String(Math.round(priceVariancePct * 100) / 100) : null,
      varianceFlag,
      sortOrder: i,
    };
  });

  // Overall match status
  const hasViolation = enrichedLines.some((l: any) => l.varianceFlag === 'violation');
  const hasMinor = enrichedLines.some((l: any) => l.varianceFlag === 'minor');
  const matchStatus = hasViolation ? 'discrepant' : hasMinor ? 'minor_variance' : 'matched';

  const totalFob = enrichedLines.reduce((s: number, l: any) => s + parseFloat(l.totalValue), 0);
  const totalCif = totalFob + parseFloat(header.freightAmount || 0) + parseFloat(header.insuranceAmount || 0);
  const rate = parseFloat(header.exchangeRate || 280);
  const totalCifPkr = totalCif * rate;

  const violationLines = enrichedLines.filter((l: any) => l.varianceFlag !== 'ok');
  const matchSummary = JSON.stringify({
    totalLines: enrichedLines.length, violations: violationLines.length,
    matchStatus, checkedAt: new Date().toISOString(),
  });

  const [ci] = await tdb.insert(commercialInvoices).values({
    ciNo: header.ciNo,
    ciDate: header.ciDate,
    poId: header.poId,
    piId: header.piId || null,
    lcId: header.lcId || null,
    shipmentId: header.shipmentId || null,
    supplierId: header.supplierId,
    currency: header.currency ?? 'USD',
    exchangeRate: String(rate),
    portOfLoading: header.portOfLoading || null,
    portOfDischarge: header.portOfDischarge || null,
    incoterms: header.incoterms ?? 'CIF',
    netWeightKg: header.netWeightKg ? String(header.netWeightKg) : null,
    grossWeightKg: header.grossWeightKg ? String(header.grossWeightKg) : null,
    packageCount: header.packageCount ? parseInt(header.packageCount) : null,
    marksNumbers: header.marksNumbers || null,
    countryOfOrigin: header.countryOfOrigin || null,
    freightAmount: String(parseFloat(header.freightAmount || 0)),
    insuranceAmount: String(parseFloat(header.insuranceAmount || 0)),
    totalFobValue: String(totalFob),
    totalCifValue: String(totalCif),
    totalCifPkr: String(totalCifPkr),
    status: 'received',
    matchStatus,
    matchSummary,
    notes: header.notes || null,
    createdById: session.user.id,
  }).returning();

  if (enrichedLines.length > 0) {
    await tdb.insert(commercialInvoiceLines).values(
      enrichedLines.map((l: any) => ({ ciId: ci.id, ...l }))
    );
  }

  return NextResponse.json({ ...ci, matchStatus, matchSummary: JSON.parse(matchSummary) }, { status: 201 });
}
