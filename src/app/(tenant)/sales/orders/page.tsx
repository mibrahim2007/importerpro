import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesOrders, customers } from '@/db/schema';
import { desc, eq, count, sum } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SalesOrderListClient } from '@/components/sales/so-list-client';

export const revalidate = 0;

export default async function SalesOrdersPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: salesOrders.id, soNo: salesOrders.soNo, soDate: salesOrders.soDate,
      status: salesOrders.status, creditCheck: salesOrders.creditCheck,
      grandTotalPkr: salesOrders.grandTotalPkr, paymentTerms: salesOrders.paymentTerms,
      requestedDeliveryDate: salesOrders.requestedDeliveryDate,
      promisedDeliveryDate: salesOrders.promisedDeliveryDate,
      quotationId: salesOrders.quotationId, createdAt: salesOrders.createdAt,
      customerName: customers.name, customerCode: customers.code,
    })
    .from(salesOrders)
    .leftJoin(customers, eq(customers.id, salesOrders.customerId))
    .orderBy(desc(salesOrders.createdAt)),

    tdb.select({ status: salesOrders.status, cnt: count(), val: sum(salesOrders.grandTotalPkr) })
      .from(salesOrders)
      .groupBy(salesOrders.status),
  ]);

  const byStatus = Object.fromEntries(stats.map((s) => [s.status, { cnt: Number(s.cnt), val: parseFloat(s.val ?? '0') }]));
  const confirmed = (byStatus['confirmed']?.cnt ?? 0) + (byStatus['partially_dispatched']?.cnt ?? 0);
  const activeVal = ['confirmed', 'partially_dispatched'].reduce((s, k) => s + (byStatus[k]?.val ?? 0), 0);
  const pendingCredit = byStatus['pending_approval']?.cnt ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sales Orders</h1>
          <p className="text-sm text-slate-500">Confirmed orders with stock reservation and dispatch tracking</p>
        </div>
        <Link href="/sales/orders/new">
          <Button className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1.5 h-4 w-4" />New Order</Button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: rows.length, sub: null },
          { label: 'Active (Confirmed)', value: confirmed, sub: null },
          { label: 'Credit Hold', value: pendingCredit, sub: null, alert: pendingCredit > 0 },
          { label: 'Active Order Value', value: `PKR ${(activeVal / 1000).toFixed(0)}K`, sub: null },
        ].map(({ label, value, alert }) => (
          <div key={label} className={`rounded-xl border p-4 ${alert ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
            <p className={`text-xs ${alert ? 'text-amber-600' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-2xl font-bold mt-1 ${alert ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
          </div>
        ))}
      </div>

      <SalesOrderListClient rows={rows} />
    </div>
  );
}
