import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { grns, warehouses } from '@/db/schema';
import { eq, count, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, PackageCheck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft:       'bg-slate-100 text-slate-500',
  posted:      'bg-teal-100 text-teal-700',
  qc_hold:     'bg-amber-100 text-amber-700',
  qc_released: 'bg-green-100 text-green-700',
  cancelled:   'bg-slate-100 text-slate-400',
};

export default async function GrnListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { status: filterStatus } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allGrns, statusCounts, allWarehouses] = await Promise.all([
    tdb.select({
      id: grns.id,
      grnNo: grns.grnNo,
      grnDate: grns.grnDate,
      poId: grns.poId,
      shipmentId: grns.shipmentId,
      warehouseId: grns.warehouseId,
      deliveryChallanNo: grns.deliveryChallanNo,
      vehicleNo: grns.vehicleNo,
      status: grns.status,
      postedAt: grns.postedAt,
      createdAt: grns.createdAt,
    }).from(grns).orderBy(desc(grns.createdAt)),
    tdb.select({ status: grns.status, count: count() }).from(grns).groupBy(grns.status),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
  ]);

  const whMap = Object.fromEntries(allWarehouses.map((w) => [w.id, w.name]));
  const countFor = (s: string) => Number(statusCounts.find((x) => x.status === s)?.count ?? 0);
  const filtered = filterStatus ? allGrns.filter((g) => g.status === filterStatus) : allGrns;
  const qcHoldCount = countFor('qc_hold');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Receipt Notes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record and track goods received at warehouse</p>
        </div>
        <Link href="/import/grn/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" /> New GRN
          </Button>
        </Link>
      </div>

      {qcHoldCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {qcHoldCount} GRN{qcHoldCount > 1 ? 's' : ''} awaiting QC release — stock is on hold until QC completes.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'All', s: undefined, icon: PackageCheck, cnt: allGrns.length, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Draft', s: 'draft', icon: Clock, cnt: countFor('draft'), color: 'text-slate-500', bg: 'bg-slate-50' },
          { label: 'QC Hold', s: 'qc_hold', icon: AlertTriangle, cnt: qcHoldCount, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Posted / Released', s: 'posted', icon: CheckCircle2, cnt: countFor('posted') + countFor('qc_released'), color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, s, icon: Icon, cnt, color, bg }) => {
          const active = filterStatus === s || (!filterStatus && !s);
          return (
            <Link key={label} href={s ? `?status=${s}` : '/import/grn'}>
              <Card className={`cursor-pointer transition-all ${active ? 'ring-2 ring-teal-500' : 'hover:shadow-sm'}`}>
                <CardContent className={`p-4 ${bg} rounded-xl`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{label}</p>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <p className={`text-2xl font-bold mt-1 ${color}`}>{cnt}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-slate-600">GRN No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Warehouse</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Challan / Vehicle</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No GRNs found</td></tr>
            ) : filtered.map((g) => (
              <tr key={g.id} className={`border-b hover:bg-slate-50 ${g.status === 'qc_hold' ? 'bg-amber-50' : ''}`}>
                <td className="px-4 py-3">
                  <Link href={`/import/grn/${g.id}`} className="font-mono font-bold text-teal-700 hover:underline">
                    {g.grnNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(g.grnDate).toLocaleDateString('en-PK')}
                </td>
                <td className="px-4 py-3 text-slate-600">{whMap[g.warehouseId] ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {g.deliveryChallanNo && <p>DC: {g.deliveryChallanNo}</p>}
                  {g.vehicleNo && <p>{g.vehicleNo}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[g.status ?? 'draft']}`}>
                    {(g.status ?? 'draft').replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
