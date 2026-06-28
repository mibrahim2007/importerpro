import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { purchaseOrders, suppliers, poLines, shipments, grnLines, grns } from '@/db/schema';
import { and, eq, ne, notInArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpenPoClient } from '@/components/reports/open-po-client';

export const revalidate = 0;

export default async function OpenPoPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      poId: purchaseOrders.id,
      poNo: purchaseOrders.poNo,
      poDate: purchaseOrders.poDate,
      status: purchaseOrders.status,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      cifValueUsd: purchaseOrders.cifValueUsd,
      currency: purchaseOrders.currency,
      latestShipDate: purchaseOrders.latestShipDate,
      orderedQty: sql<string>`COALESCE(SUM(${poLines.qty}), 0)`,
      eta: shipments.eta,
      shipmentStatus: shipments.status,
      receivedQty: sql<string>`COALESCE(SUM(CASE WHEN ${grns.status} IN ('posted', 'qc_hold', 'qc_released') THEN ${grnLines.receivedQty} ELSE 0 END), 0)`,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .leftJoin(poLines, eq(poLines.poId, purchaseOrders.id))
    .leftJoin(shipments, eq(shipments.poId, purchaseOrders.id))
    .leftJoin(grns, eq(grns.shipmentId, shipments.id))
    .leftJoin(grnLines, eq(grnLines.grnId, grns.id))
    .where(notInArray(purchaseOrders.status, ['cancelled', 'fully_received']))
    .groupBy(purchaseOrders.id, suppliers.id, shipments.eta, shipments.status);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Open PO Status</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ordered vs received quantities with estimated arrival</p>
        </div>
      </div>
      <OpenPoClient rows={rows} />
    </div>
  );
}
