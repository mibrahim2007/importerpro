import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { goodsDeclarations, gdLines, shipments, purchaseOrders, suppliers } from '@/db/schema';
import { desc, eq, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DutyRegisterClient } from '@/components/reports/duty-register-client';

export const revalidate = 0;

export default async function DutyRegisterPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const gds = await tdb
    .select({
      gdId: goodsDeclarations.id,
      gdNo: goodsDeclarations.gdNo,
      gdDate: goodsDeclarations.gdDate,
      customsStation: goodsDeclarations.customsStation,
      exchangeRate: goodsDeclarations.exchangeRate,
      psidDate: goodsDeclarations.psidDate,
      totalAssessableValuePkr: goodsDeclarations.totalAssessableValuePkr,
      totalCustomsDutyPkr: goodsDeclarations.totalCustomsDutyPkr,
      totalSalesTaxPkr: goodsDeclarations.totalSalesTaxPkr,
      totalOtherDutyPkr: goodsDeclarations.totalOtherDutyPkr,
      totalPayablePkr: goodsDeclarations.totalPayablePkr,
      gdStatus: goodsDeclarations.status,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      shipmentNo: shipments.shipmentNo,
    })
    .from(goodsDeclarations)
    .leftJoin(shipments, eq(shipments.id, goodsDeclarations.shipmentId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, shipments.poId))
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(ne(goodsDeclarations.status, 'cancelled'))
    .orderBy(desc(goodsDeclarations.createdAt));

  const lines = await tdb
    .select({
      gdId: gdLines.gdId,
      hsCode: gdLines.hsCode,
      description: gdLines.commodityDescription,
      assessableValuePkr: gdLines.assessableValuePkr,
      cdPkr: gdLines.customsDutyPkr,
      acdPkr: gdLines.additionalCdPkr,
      rdPkr: gdLines.regulatoryDutyPkr,
      stPkr: gdLines.salesTaxPkr,
      whtPkr: gdLines.whtPkr,
      itAdvPkr: gdLines.incomeTaxPkr,
      totalDutyPkr: gdLines.totalDutyPkr,
    })
    .from(gdLines);

  const linesByGd: Record<string, typeof lines> = {};
  for (const l of lines) { (linesByGd[l.gdId] ??= []).push(l); }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Import Duty Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">FBR-compliant duty register with HS code level detail</p>
        </div>
      </div>
      <DutyRegisterClient gds={gds} linesByGd={linesByGd} />
    </div>
  );
}
