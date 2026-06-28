import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { dispatchChallans, salesOrders, customers } from '@/db/schema';
import { desc, eq, count } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DcListClient } from '@/components/sales/dc-list-client';

export const revalidate = 0;

export default async function DispatchPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: dispatchChallans.id, dcNo: dispatchChallans.dcNo, dcDate: dispatchChallans.dcDate,
      status: dispatchChallans.status, vehicleNo: dispatchChallans.vehicleNo,
      gatePassNo: dispatchChallans.gatePassNo, gateOutTime: dispatchChallans.gateOutTime,
      estimatedArrivalDate: dispatchChallans.estimatedArrivalDate,
      deliveryConfirmedDate: dispatchChallans.deliveryConfirmedDate,
      freightResponsibility: dispatchChallans.freightResponsibility,
      createdAt: dispatchChallans.createdAt,
      soNo: salesOrders.soNo, customerName: customers.name,
    })
    .from(dispatchChallans)
    .leftJoin(salesOrders, eq(salesOrders.id, dispatchChallans.soId))
    .leftJoin(customers, eq(customers.id, dispatchChallans.customerId))
    .orderBy(desc(dispatchChallans.createdAt)),

    tdb.select({ status: dispatchChallans.status, cnt: count() })
      .from(dispatchChallans).groupBy(dispatchChallans.status),
  ]);

  const byStatus = Object.fromEntries(stats.map((s) => [s.status, Number(s.cnt)]));
  const inTransit = byStatus['in_transit'] ?? 0;
  const delivered = byStatus['delivered'] ?? 0;
  const pending = (byStatus['draft'] ?? 0) + (byStatus['approved'] ?? 0) + (byStatus['gate_pass_issued'] ?? 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dispatch & Delivery</h1>
          <p className="text-sm text-slate-500">Dispatch challans and delivery tracking</p>
        </div>
        <Link href="/sales/dispatch/new">
          <Button className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1.5 h-4 w-4" />New Dispatch Challan</Button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total DCs', value: rows.length },
          { label: 'Pending Dispatch', value: pending },
          { label: 'In Transit', value: inTransit },
          { label: 'Delivered', value: delivered },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <DcListClient rows={rows} />
    </div>
  );
}
