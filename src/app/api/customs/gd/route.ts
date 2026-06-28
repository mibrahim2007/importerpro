import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { goodsDeclarations, gdLines, shipments } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(goodsDeclarations).orderBy(desc(goodsDeclarations.createdAt));
  return NextResponse.json(rows);
}

function computeLineTotals(lines: any[]) {
  return lines.map((l) => {
    const assessable = Number(l.assessableValuePkr ?? l.cifValuePkr ?? 0);
    const cd = (assessable * Number(l.customsDutyPct ?? 0)) / 100;
    const acd = (assessable * Number(l.additionalCdPct ?? 0)) / 100;
    const rd = (assessable * Number(l.regulatoryDutyPct ?? 0)) / 100;
    const baseForST = assessable + cd + acd + rd;
    const st = (baseForST * Number(l.salesTaxPct ?? 17)) / 100;
    const wht = (assessable * Number(l.whtPct ?? 0)) / 100;
    const it = (assessable * Number(l.incomeTaxPct ?? 0)) / 100;
    const ad = Number(l.antiDumpingDutyPkr ?? 0);
    const sroDeduct = Number(l.sroDeductionPkr ?? 0);
    const total = cd + acd + rd + st + wht + it + ad - sroDeduct;
    return {
      ...l,
      customsDutyPkr: cd.toFixed(2),
      additionalCdPkr: acd.toFixed(2),
      regulatoryDutyPkr: rd.toFixed(2),
      salesTaxPkr: st.toFixed(2),
      whtPkr: wht.toFixed(2),
      incomeTaxPkr: it.toFixed(2),
      totalDutyPkr: total.toFixed(2),
    };
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();

  const computedLines = computeLineTotals(body.lines ?? []);

  const totalAssessable = computedLines.reduce((s: number, l: any) => s + Number(l.assessableValuePkr ?? l.cifValuePkr ?? 0), 0);
  const totalCD = computedLines.reduce((s: number, l: any) => s + Number(l.customsDutyPkr), 0);
  const totalST = computedLines.reduce((s: number, l: any) => s + Number(l.salesTaxPkr), 0);
  const totalOther = computedLines.reduce((s: number, l: any) => s + Number(l.additionalCdPkr) + Number(l.regulatoryDutyPkr) + Number(l.whtPkr) + Number(l.incomeTaxPkr) + Number(l.antiDumpingDutyPkr ?? 0), 0);
  const totalPayable = totalCD + totalST + totalOther - computedLines.reduce((s: number, l: any) => s + Number(l.sroDeductionPkr ?? 0), 0);

  const [gd] = await tdb.insert(goodsDeclarations).values({
    gdNo: body.gdNo || null,
    gdDate: body.gdDate || null,
    gdType: body.gdType ?? 'home_consumption',
    shipmentId: body.shipmentId || null,
    clearingAgentName: body.clearingAgentName || null,
    customsStation: body.customsStation || null,
    importRegNo: body.importRegNo || null,
    ntn: body.ntn || null,
    strn: body.strn || null,
    exchangeRate: body.exchangeRate ? String(body.exchangeRate) : null,
    srosApplied: body.srosApplied || null,
    notes: body.notes || null,
    totalAssessableValuePkr: totalAssessable.toFixed(2),
    totalCustomsDutyPkr: totalCD.toFixed(2),
    totalSalesTaxPkr: totalST.toFixed(2),
    totalOtherDutyPkr: totalOther.toFixed(2),
    totalPayablePkr: totalPayable.toFixed(2),
    createdById: session.user.id,
  }).returning();

  if (computedLines.length > 0) {
    await tdb.insert(gdLines).values(
      computedLines.map((l: any, i: number) => ({
        gdId: gd.id,
        hsCode: l.hsCode,
        commodityDescription: l.commodityDescription,
        countryOfOrigin: l.countryOfOrigin || null,
        qty: l.qty ? String(l.qty) : null,
        uom: l.uom || null,
        cifValuePkr: l.cifValuePkr ? String(l.cifValuePkr) : null,
        assessableValuePkr: l.assessableValuePkr ? String(l.assessableValuePkr) : String(l.cifValuePkr ?? 0),
        customsDutyPct: l.customsDutyPct ? String(l.customsDutyPct) : null,
        customsDutyPkr: l.customsDutyPkr,
        additionalCdPct: l.additionalCdPct ? String(l.additionalCdPct) : null,
        additionalCdPkr: l.additionalCdPkr,
        regulatoryDutyPct: l.regulatoryDutyPct ? String(l.regulatoryDutyPct) : null,
        regulatoryDutyPkr: l.regulatoryDutyPkr,
        salesTaxPct: String(l.salesTaxPct ?? 17),
        salesTaxPkr: l.salesTaxPkr,
        whtPct: l.whtPct ? String(l.whtPct) : null,
        whtPkr: l.whtPkr,
        incomeTaxPct: l.incomeTaxPct ? String(l.incomeTaxPct) : null,
        incomeTaxPkr: l.incomeTaxPkr,
        antiDumpingDutyPkr: l.antiDumpingDutyPkr ? String(l.antiDumpingDutyPkr) : null,
        sroDeductionPkr: l.sroDeductionPkr ? String(l.sroDeductionPkr) : null,
        totalDutyPkr: l.totalDutyPkr,
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(gd, { status: 201 });
}
