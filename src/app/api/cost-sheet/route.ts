import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import {
  landedCosts, shipments, goodsDeclarations, letterOfCredits, lcCharges,
  grns, grnLines, purchaseOrders,
} from '@/db/schema';
import { eq, desc, sum, sql } from 'drizzle-orm';

function computeTotals(data: Record<string, number>) {
  const dutyTaxes =
    (data.customsDutyPkr ?? 0) +
    (data.additionalCdPkr ?? 0) +
    (data.regulatoryDutyPkr ?? 0) +
    (data.salesTaxAdjPkr ?? 0) +
    (data.salesTaxNonAdjPkr ?? 0) +
    (data.whtPkr ?? 0) +
    (data.incomeTaxPkr ?? 0);

  const total =
    (data.cifValuePkr ?? 0) +
    dutyTaxes +
    (data.clearingAgentFeePkr ?? 0) +
    (data.documentationChargesPkr ?? 0) +
    (data.examinationChargesPkr ?? 0) +
    (data.thcPkr ?? 0) +
    (data.wharfagePkr ?? 0) +
    (data.portTrustPkr ?? 0) +
    (data.scanningFeePkr ?? 0) +
    (data.demurragePkr ?? 0) +
    (data.detentionPkr ?? 0) +
    (data.lcChargesPkr ?? 0) +
    (data.inlandFreightPkr ?? 0) +
    (data.otherChargesPkr ?? 0);

  const perUnit = data.totalQtyReceived && data.totalQtyReceived > 0
    ? total / data.totalQtyReceived
    : 0;

  return { totalDutyTaxesPkr: dutyTaxes, totalLandedCostPkr: total, landedCostPerUnitPkr: perUnit };
}

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const sheets = await tdb.select().from(landedCosts).orderBy(desc(landedCosts.createdAt));
  return NextResponse.json({ sheets });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { shipmentId, gdId, lcId, grnId } = body;

  if (!shipmentId) return NextResponse.json({ error: 'Shipment is required' }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Auto-populate from linked records
  const [[shipment], [gd], [grn]] = await Promise.all([
    tdb.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1),
    gdId ? tdb.select().from(goodsDeclarations).where(eq(goodsDeclarations.id, gdId)).limit(1) : Promise.resolve([null]),
    grnId ? tdb.select().from(grns).where(eq(grns.id, grnId)).limit(1) : Promise.resolve([null]),
  ]);

  if (!shipment) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });

  // Load PO for FOB/CIF values
  let po: any = null;
  if (shipment.poId) {
    const [poRow] = await tdb.select().from(purchaseOrders).where(eq(purchaseOrders.id, shipment.poId)).limit(1);
    po = poRow ?? null;
  }

  // Sum LC charges if LC linked
  let lcChargesTotal = 0;
  if (lcId) {
    const charges = await tdb.select({ total: sql<string>`SUM(${lcCharges.amount})` })
      .from(lcCharges).where(eq(lcCharges.lcId, lcId));
    lcChargesTotal = parseFloat(charges[0]?.total ?? '0');
  }

  // Sum GRN received qty
  let totalQty = 0;
  let qtyUom = '';
  if (grnId) {
    const lines = await tdb.select({ qty: grnLines.receivedQty, uom: grnLines.uom }).from(grnLines).where(eq(grnLines.grnId, grnId));
    totalQty = lines.reduce((s, l) => s + parseFloat(l.qty ?? '0'), 0);
    qtyUom = lines[0]?.uom ?? '';
  }

  // Auto-fill from GD
  const gdData = gd ? {
    customsDutyPkr: parseFloat(gd.totalCustomsDutyPkr ?? '0'),
    additionalCdPkr: 0,
    regulatoryDutyPkr: 0,
    salesTaxAdjPkr: parseFloat(gd.totalSalesTaxPkr ?? '0'),
    salesTaxNonAdjPkr: 0,
    whtPkr: 0,
    incomeTaxPkr: 0,
    examinationChargesPkr: parseFloat(gd.examinationChargesPkr ?? '0'),
    exchangeRateApplied: parseFloat(gd.exchangeRate ?? '1'),
  } : {};

  // CIF from PO or compute from shipment
  const fobValueUsd = po ? parseFloat(po.subtotalAmount ?? '0') : 0;
  const freightUsd = po ? parseFloat(po.freightAmount ?? '0') : parseFloat(shipment.freightAmount ?? '0');
  const insuranceUsd = po ? parseFloat(po.insuranceAmount ?? '0') : 0;
  const cifValueUsd = po ? parseFloat(po.cifValueUsd ?? '0') : (fobValueUsd + freightUsd + insuranceUsd);
  const exchangeRate = gdData.exchangeRateApplied ?? parseFloat(po?.exchangeRate ?? '1');
  const cifValuePkr = cifValueUsd * exchangeRate;

  const costData: Record<string, number> = {
    cifValuePkr,
    customsDutyPkr: gdData.customsDutyPkr ?? 0,
    additionalCdPkr: gdData.additionalCdPkr ?? 0,
    regulatoryDutyPkr: gdData.regulatoryDutyPkr ?? 0,
    salesTaxAdjPkr: gdData.salesTaxAdjPkr ?? 0,
    salesTaxNonAdjPkr: 0,
    whtPkr: gdData.whtPkr ?? 0,
    incomeTaxPkr: gdData.incomeTaxPkr ?? 0,
    clearingAgentFeePkr: 0,
    documentationChargesPkr: 0,
    examinationChargesPkr: gdData.examinationChargesPkr ?? 0,
    thcPkr: 0,
    wharfagePkr: 0,
    portTrustPkr: 0,
    scanningFeePkr: 0,
    demurragePkr: 0,
    detentionPkr: 0,
    lcChargesPkr: lcChargesTotal,
    inlandFreightPkr: 0,
    otherChargesPkr: 0,
    totalQtyReceived: totalQty,
  };

  const { totalDutyTaxesPkr, totalLandedCostPkr, landedCostPerUnitPkr } = computeTotals(costData);

  const year = new Date().getFullYear();
  const count = await tdb.$count(landedCosts);
  const costSheetNo = `LCS-${year}-${String(count + 1).padStart(4, '0')}`;

  const [sheet] = await tdb.insert(landedCosts).values({
    costSheetNo,
    shipmentId,
    gdId: gdId || null,
    lcId: lcId || null,
    grnId: grnId || null,
    fobValueUsd: String(fobValueUsd),
    freightUsd: String(freightUsd),
    insuranceUsd: String(insuranceUsd),
    cifValueUsd: String(cifValueUsd),
    exchangeRateApplied: String(exchangeRate),
    cifValuePkr: String(cifValuePkr),
    customsDutyPkr: String(costData.customsDutyPkr),
    additionalCdPkr: String(costData.additionalCdPkr),
    regulatoryDutyPkr: String(costData.regulatoryDutyPkr),
    salesTaxAdjPkr: String(costData.salesTaxAdjPkr),
    salesTaxNonAdjPkr: '0',
    whtPkr: String(costData.whtPkr),
    incomeTaxPkr: String(costData.incomeTaxPkr),
    clearingAgentFeePkr: '0',
    documentationChargesPkr: '0',
    examinationChargesPkr: String(costData.examinationChargesPkr),
    thcPkr: '0', wharfagePkr: '0', portTrustPkr: '0', scanningFeePkr: '0',
    demurragePkr: '0', detentionPkr: '0',
    lcChargesPkr: String(lcChargesTotal),
    inlandFreightPkr: '0',
    otherChargesPkr: '0',
    totalDutyTaxesPkr: String(totalDutyTaxesPkr),
    totalLandedCostPkr: String(totalLandedCostPkr),
    totalQtyReceived: totalQty > 0 ? String(totalQty) : null,
    qtyUom: qtyUom || null,
    landedCostPerUnitPkr: String(landedCostPerUnitPkr),
    createdById: session.user.id as any,
  }).returning();

  return NextResponse.json({ sheet }, { status: 201 });
}
