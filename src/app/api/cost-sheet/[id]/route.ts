import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { landedCosts } from '@/db/schema';
import { eq } from 'drizzle-orm';

const NUM_FIELDS = [
  'fobValueUsd','freightUsd','insuranceUsd','cifValueUsd','exchangeRateApplied','cifValuePkr',
  'customsDutyPkr','additionalCdPkr','regulatoryDutyPkr','salesTaxAdjPkr','salesTaxNonAdjPkr','whtPkr','incomeTaxPkr',
  'clearingAgentFeePkr','documentationChargesPkr','examinationChargesPkr',
  'thcPkr','wharfagePkr','portTrustPkr','scanningFeePkr','demurragePkr','detentionPkr',
  'lcChargesPkr','inlandFreightPkr','otherChargesPkr','totalQtyReceived',
] as const;

function computeTotals(data: Record<string, number>) {
  const dutyTaxes = (['customsDutyPkr','additionalCdPkr','regulatoryDutyPkr','salesTaxAdjPkr','salesTaxNonAdjPkr','whtPkr','incomeTaxPkr'] as const)
    .reduce((s, k) => s + (data[k] ?? 0), 0);

  const total = (data.cifValuePkr ?? 0) + dutyTaxes +
    (['clearingAgentFeePkr','documentationChargesPkr','examinationChargesPkr','thcPkr','wharfagePkr','portTrustPkr','scanningFeePkr','demurragePkr','detentionPkr','lcChargesPkr','inlandFreightPkr','otherChargesPkr'] as const)
      .reduce((s, k) => s + (data[k] ?? 0), 0);

  const perUnit = data.totalQtyReceived && data.totalQtyReceived > 0 ? total / data.totalQtyReceived : 0;
  return { totalDutyTaxesPkr: dutyTaxes, totalLandedCostPkr: total, landedCostPerUnitPkr: perUnit };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [sheet] = await tdb.select().from(landedCosts).where(eq(landedCosts.id, id)).limit(1);
  if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ sheet });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { action, ...fields } = body;

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [sheet] = await tdb.select().from(landedCosts).where(eq(landedCosts.id, id)).limit(1);
  if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (sheet.status === 'finalized' && action !== 'reopen') return NextResponse.json({ error: 'Cost sheet is finalized' }, { status: 422 });

  if (action === 'finalize') {
    await tdb.update(landedCosts).set({ status: 'finalized', finalizedAt: new Date(), updatedAt: new Date() }).where(eq(landedCosts.id, id));
  } else if (action === 'reopen') {
    await tdb.update(landedCosts).set({ status: 'draft', finalizedAt: null as any, updatedAt: new Date() }).where(eq(landedCosts.id, id));
  } else {
    // Field update — re-compute totals
    const mergedData: Record<string, number> = {};
    for (const f of NUM_FIELDS) {
      const current = parseFloat((sheet as any)[f] ?? '0');
      mergedData[f] = fields[f] !== undefined ? parseFloat(fields[f]) : current;
    }
    // Recompute CIF if exchange rate or USD values changed
    if (fields.exchangeRateApplied !== undefined || fields.cifValueUsd !== undefined) {
      mergedData.cifValuePkr = mergedData.cifValueUsd * mergedData.exchangeRateApplied;
    }

    const { totalDutyTaxesPkr, totalLandedCostPkr, landedCostPerUnitPkr } = computeTotals(mergedData);

    const updatePayload: Record<string, any> = { updatedAt: new Date() };
    for (const f of NUM_FIELDS) {
      if (fields[f] !== undefined) updatePayload[f] = String(mergedData[f]);
    }
    if (fields.exchangeRateApplied !== undefined || fields.cifValueUsd !== undefined) {
      updatePayload.cifValuePkr = String(mergedData.cifValuePkr);
    }
    if (fields.otherChargesDesc !== undefined) updatePayload.otherChargesDesc = fields.otherChargesDesc;
    if (fields.qtyUom !== undefined) updatePayload.qtyUom = fields.qtyUom;
    if (fields.notes !== undefined) updatePayload.notes = fields.notes;

    updatePayload.totalDutyTaxesPkr = String(totalDutyTaxesPkr);
    updatePayload.totalLandedCostPkr = String(totalLandedCostPkr);
    updatePayload.landedCostPerUnitPkr = String(landedCostPerUnitPkr);

    await tdb.update(landedCosts).set(updatePayload).where(eq(landedCosts.id, id));
  }

  const [updated] = await tdb.select().from(landedCosts).where(eq(landedCosts.id, id)).limit(1);
  return NextResponse.json({ sheet: updated });
}
