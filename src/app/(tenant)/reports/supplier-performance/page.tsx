import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { suppliers, purchaseOrders, shipments, grns } from '@/db/schema';
import { eq, ne, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SupplierPerformanceClient } from '@/components/reports/supplier-performance-client';

export const revalidate = 0;

export default async function SupplierPerformancePage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      leadTimeDays: suppliers.leadTimeDays,
      poCount: sql<number>`COUNT(DISTINCT ${purchaseOrders.id})::int`,
      completedPoCount: sql<number>`COUNT(DISTINCT CASE WHEN ${purchaseOrders.status} = 'fully_received' THEN ${purchaseOrders.id} END)::int`,
      totalCifUsd: sql<string>`COALESCE(SUM(${purchaseOrders.cifValueUsd}), 0)`,
      onTimeCount: sql<number>`COUNT(DISTINCT CASE WHEN ${shipments.ata} IS NOT NULL AND ${shipments.eta} IS NOT NULL AND ${shipments.ata} <= ${shipments.eta} THEN ${shipments.id} END)::int`,
      arrivedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${shipments.ata} IS NOT NULL THEN ${shipments.id} END)::int`,
      avgGrnDays: sql<string>`AVG(CASE WHEN ${grns.grnDate} IS NOT NULL AND ${purchaseOrders.poDate} IS NOT NULL THEN ${grns.grnDate}::date - ${purchaseOrders.poDate}::date END)`,
    })
    .from(suppliers)
    .leftJoin(purchaseOrders, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(shipments, eq(shipments.poId, purchaseOrders.id))
    .leftJoin(grns, eq(grns.shipmentId, shipments.id))
    .where(ne(suppliers.complianceStatus, 'blacklisted'))
    .groupBy(suppliers.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Supplier Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">PO count, lead time, on-time delivery, and total import value by supplier</p>
        </div>
      </div>
      <SupplierPerformanceClient rows={rows} />
    </div>
  );
}
