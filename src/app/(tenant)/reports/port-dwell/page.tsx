import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments, shipmentContainers } from '@/db/schema';
import { isNotNull, ne, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PortDwellClient } from '@/components/reports/port-dwell-client';

export const revalidate = 0;

export default async function PortDwellPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Per-shipment dwell: ATA to GD cleared date (or today if still at port)
  const shipmentRows = await tdb
    .select({
      shipmentId: shipments.id,
      shipmentNo: shipments.shipmentNo,
      portOfDischarge: shipments.portOfDischarge,
      ata: shipments.ata,
      eta: shipments.eta,
      status: shipments.status,
      doReleasedDate: shipments.doReleasedDate,
    })
    .from(shipments)
    .where(isNotNull(shipments.ata));

  // Per-port aggregation
  const portStats = await tdb
    .select({
      port: shipments.portOfDischarge,
      count: sql<number>`COUNT(*)::int`,
      avgDwellDays: sql<string>`AVG(CASE WHEN ${shipments.doReleasedDate} IS NOT NULL AND ${shipments.ata} IS NOT NULL THEN ${shipments.doReleasedDate}::date - ${shipments.ata}::date END)`,
      maxDwellDays: sql<number>`MAX(CASE WHEN ${shipments.doReleasedDate} IS NOT NULL AND ${shipments.ata} IS NOT NULL THEN ${shipments.doReleasedDate}::date - ${shipments.ata}::date END)::int`,
    })
    .from(shipments)
    .where(isNotNull(shipments.ata))
    .groupBy(shipments.portOfDischarge);

  // Demurrage containers
  const demurrageStats = await tdb
    .select({
      shipmentId: shipmentContainers.shipmentId,
      containerCount: sql<number>`COUNT(*)::int`,
      demurrageCount: sql<number>`COUNT(CASE WHEN ${shipmentContainers.demurragePaidAmount} IS NOT NULL THEN 1 END)::int`,
      totalDemurrage: sql<string>`COALESCE(SUM(${shipmentContainers.demurragePaidAmount}), 0)`,
    })
    .from(shipmentContainers)
    .groupBy(shipmentContainers.shipmentId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Port Dwell Time Analysis</h1>
          <p className="text-sm text-slate-500 mt-0.5">ATA to DO release days per port, demurrage incidence</p>
        </div>
      </div>
      <PortDwellClient portStats={portStats} shipmentRows={shipmentRows} demurrageStats={demurrageStats} />
    </div>
  );
}
