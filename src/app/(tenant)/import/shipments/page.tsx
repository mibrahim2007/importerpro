import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments, purchaseOrders } from '@/db/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Ship, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const STATUS_BADGE: Record<string, string> = {
  draft:           'bg-slate-100 text-slate-500',
  booked:          'bg-blue-100 text-blue-600',
  sailing:         'bg-indigo-100 text-indigo-600',
  arrived:         'bg-amber-100 text-amber-700',
  do_released:     'bg-orange-100 text-orange-700',
  customs_cleared: 'bg-teal-100 text-teal-700',
  grn_done:        'bg-green-100 text-green-700',
  cancelled:       'bg-slate-100 text-slate-400',
};

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { status: filterStatus } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allShipments, statusCounts] = await Promise.all([
    tdb.select({
      id: shipments.id,
      shipmentNo: shipments.shipmentNo,
      poId: shipments.poId,
      blNo: shipments.blNo,
      vesselName: shipments.vesselName,
      portOfDischarge: shipments.portOfDischarge,
      eta: shipments.eta,
      ata: shipments.ata,
      status: shipments.status,
      mode: shipments.mode,
      shippingLineName: shipments.shippingLineName,
      doReleasedDate: shipments.doReleasedDate,
    }).from(shipments).orderBy(desc(shipments.createdAt)),
    tdb.select({ status: shipments.status, count: count() }).from(shipments).groupBy(shipments.status),
  ]);

  const countFor = (s: string) => statusCounts.find((x) => x.status === s)?.count ?? 0;
  const filtered = filterStatus ? allShipments.filter((s) => s.status === filterStatus) : allShipments;

  const today = new Date();
  const overdueDemurrage = allShipments.filter(
    (s) => s.ata && ['arrived', 'do_released'].includes(s.status ?? '') &&
      differenceInDays(today, new Date(s.ata)) > 7
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track consignments from dispatch to GRN</p>
        </div>
        <Link href="/import/shipments/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" /> New Shipment
          </Button>
        </Link>
      </div>

      {/* Demurrage alert banner */}
      {overdueDemurrage > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {overdueDemurrage} shipment{overdueDemurrage > 1 ? 's' : ''} arrived 7+ days ago and may be accruing demurrage — clear customs immediately.
          </p>
        </div>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { status: undefined, label: 'All', icon: Ship, color: 'text-slate-600', bg: 'bg-slate-50' },
          { status: 'sailing', label: 'Sailing', icon: Ship, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { status: 'arrived', label: 'At Port', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
          { status: 'grn_done', label: 'Received', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ status: s, label, icon: Icon, color, bg }) => {
          const cnt = s ? Number(countFor(s)) : allShipments.length;
          const active = filterStatus === s || (!filterStatus && !s);
          return (
            <Link key={label} href={s ? `?status=${s}` : '/import/shipments'}>
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

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Shipment No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">B/L No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Vessel</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Port</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">ETA / ATA</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Port Dwell</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No shipments found</td></tr>
            ) : filtered.map((shp) => {
              const etaDate = shp.eta ? new Date(shp.eta) : null;
              const ataDate = shp.ata ? new Date(shp.ata) : null;
              const daysAtPort = ataDate && ['arrived', 'do_released'].includes(shp.status ?? '')
                ? differenceInDays(today, ataDate) : null;
              const demurrageRisk = daysAtPort !== null && daysAtPort > 7;

              return (
                <tr key={shp.id} className={`border-b hover:bg-slate-50 ${demurrageRisk ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/import/shipments/${shp.id}`} className="font-mono font-bold text-teal-700 hover:underline">
                      {shp.shipmentNo}
                    </Link>
                    {shp.poId && <p className="text-xs text-slate-400 mt-0.5">Linked PO</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{shp.blNo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{shp.vesselName ?? '—'}</p>
                    <p className="text-xs text-slate-400">{shp.shippingLineName ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{shp.portOfDischarge ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {ataDate ? (
                      <span className="text-green-700 font-medium">ATA: {ataDate.toLocaleDateString('en-PK')}</span>
                    ) : etaDate ? (
                      <span className={differenceInDays(etaDate, today) < 3 ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                        ETA: {etaDate.toLocaleDateString('en-PK')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[shp.status ?? 'draft']}`}>
                      {(shp.status ?? 'draft').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {daysAtPort !== null ? (
                      <span className={`font-semibold ${demurrageRisk ? 'text-red-600' : 'text-slate-600'}`}>
                        {daysAtPort}d {demurrageRisk && '⚠️'}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
