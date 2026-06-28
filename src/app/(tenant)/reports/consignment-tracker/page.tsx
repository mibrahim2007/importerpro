import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments, purchaseOrders, suppliers, goodsDeclarations, grns } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConsignmentTrackerTable } from '@/components/reports/consignment-tracker-table';

export const revalidate = 0;

export default async function ConsignmentTrackerPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      shipmentId: shipments.id,
      shipmentNo: shipments.shipmentNo,
      vesselName: shipments.vesselName,
      portOfDischarge: shipments.portOfDischarge,
      eta: shipments.eta,
      ata: shipments.ata,
      shipmentStatus: shipments.status,
      doNo: shipments.doNo,
      poId: purchaseOrders.id,
      poNo: purchaseOrders.poNo,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      cifValueUsd: purchaseOrders.cifValueUsd,
      gdId: goodsDeclarations.id,
      gdNo: goodsDeclarations.gdNo,
      psidDate: goodsDeclarations.psidDate,
      gdStatus: goodsDeclarations.status,
      grnId: grns.id,
      grnNo: grns.grnNo,
      grnDate: grns.grnDate,
      grnStatus: grns.status,
    })
    .from(shipments)
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, shipments.poId))
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .leftJoin(goodsDeclarations, eq(goodsDeclarations.shipmentId, shipments.id))
    .leftJoin(grns, eq(grns.shipmentId, shipments.id))
    .where(sql`${shipments.status} <> 'cancelled'`)
    .orderBy(desc(shipments.createdAt));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Consignment Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">Master status report for all import consignments</p>
        </div>
      </div>
      <ConsignmentTrackerTable rows={rows} />
    </div>
  );
}
