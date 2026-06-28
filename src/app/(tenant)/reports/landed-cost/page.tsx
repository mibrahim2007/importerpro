import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { landedCosts, shipments, purchaseOrders, suppliers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LandedCostReportClient } from '@/components/reports/landed-cost-report-client';

export const revalidate = 0;

export default async function LandedCostReportPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: landedCosts.id,
      costSheetNo: landedCosts.costSheetNo,
      status: landedCosts.status,
      shipmentNo: shipments.shipmentNo,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      fobValueUsd: landedCosts.fobValueUsd,
      cifValueUsd: landedCosts.cifValueUsd,
      cifValuePkr: landedCosts.cifValuePkr,
      exchangeRateApplied: landedCosts.exchangeRateApplied,
      totalDutyTaxesPkr: landedCosts.totalDutyTaxesPkr,
      clearingAgentFeePkr: landedCosts.clearingAgentFeePkr,
      documentationChargesPkr: landedCosts.documentationChargesPkr,
      examinationChargesPkr: landedCosts.examinationChargesPkr,
      thcPkr: landedCosts.thcPkr,
      wharfagePkr: landedCosts.wharfagePkr,
      lcChargesPkr: landedCosts.lcChargesPkr,
      inlandFreightPkr: landedCosts.inlandFreightPkr,
      totalLandedCostPkr: landedCosts.totalLandedCostPkr,
      totalQtyReceived: landedCosts.totalQtyReceived,
      qtyUom: landedCosts.qtyUom,
      landedCostPerUnitPkr: landedCosts.landedCostPerUnitPkr,
      createdAt: landedCosts.createdAt,
    })
    .from(landedCosts)
    .leftJoin(shipments, eq(shipments.id, landedCosts.shipmentId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, shipments.poId))
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .orderBy(desc(landedCosts.createdAt));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Landed Cost Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Per-consignment cost breakdown and unit cost comparison</p>
        </div>
      </div>
      <LandedCostReportClient rows={rows} />
    </div>
  );
}
