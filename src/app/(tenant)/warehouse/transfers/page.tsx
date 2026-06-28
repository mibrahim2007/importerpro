import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockTransfers, warehouses } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRightLeft, Plus, CheckCircle2, Clock, Truck } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-500',
  validated: 'bg-blue-100 text-blue-700',
  done:      'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

export const revalidate = 0;

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [transfers, warehouseRows] = await Promise.all([
    tdb.select().from(stockTransfers).orderBy(desc(stockTransfers.createdAt)),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
  ]);

  const whMap = Object.fromEntries(warehouseRows.map((w) => [w.id, w.name]));

  const stats = {
    all: transfers.length,
    draft: transfers.filter((t) => t.status === 'draft').length,
    validated: transfers.filter((t) => t.status === 'validated').length,
    done: transfers.filter((t) => t.status === 'done').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Internal Transfers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Move stock between warehouses and locations</p>
        </div>
        <Link href="/warehouse/transfers/new">
          <button className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Transfer
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'All Transfers', value: stats.all, icon: ArrowRightLeft, color: 'text-slate-700' },
          { label: 'Draft', value: stats.draft, icon: Clock, color: 'text-slate-500' },
          { label: 'In Transit', value: stats.validated, icon: Truck, color: 'text-blue-600' },
          { label: 'Completed', value: stats.done, icon: CheckCircle2, color: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      {transfers.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No transfers yet. Create one to move stock between locations.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Transfer No.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">From</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">To</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/warehouse/transfers/${t.id}`} className="font-mono text-teal-600 hover:underline text-sm">
                          {t.transferNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(t.transferDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{whMap[t.fromWarehouseId] ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{whMap[t.toWarehouseId] ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{t.reason ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[t.status ?? 'draft']}`}>
                          {t.status === 'validated' ? 'In Transit' : (t.status ?? 'draft')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
