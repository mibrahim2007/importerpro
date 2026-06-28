import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { goodsDeclarations, shipments } from '@/db/schema';
import { eq, count, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft:             'bg-slate-100 text-slate-500',
  filed:             'bg-blue-100 text-blue-600',
  green_channel:     'bg-green-100 text-green-700',
  yellow_channel:    'bg-yellow-100 text-yellow-700',
  red_channel:       'bg-red-100 text-red-700',
  query_raised:      'bg-orange-100 text-orange-700',
  query_replied:     'bg-amber-100 text-amber-700',
  examination_done:  'bg-purple-100 text-purple-700',
  assessment_ordered:'bg-indigo-100 text-indigo-700',
  duty_paid:         'bg-teal-100 text-teal-700',
  cleared:           'bg-green-100 text-green-700',
  cancelled:         'bg-slate-100 text-slate-400',
};

const CHANNEL_BADGE: Record<string, string> = {
  green:  'bg-green-50 text-green-600 border border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  red:    'bg-red-50 text-red-600 border border-red-200',
};

export default async function CustomsGdPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { status: filterStatus } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allGds, statusCounts] = await Promise.all([
    tdb.select({
      id: goodsDeclarations.id,
      gdNo: goodsDeclarations.gdNo,
      gdDate: goodsDeclarations.gdDate,
      gdType: goodsDeclarations.gdType,
      shipmentId: goodsDeclarations.shipmentId,
      customsStation: goodsDeclarations.customsStation,
      channel: goodsDeclarations.channel,
      totalPayablePkr: goodsDeclarations.totalPayablePkr,
      psidNo: goodsDeclarations.psidNo,
      status: goodsDeclarations.status,
      gdClearedDate: goodsDeclarations.gdClearedDate,
      createdAt: goodsDeclarations.createdAt,
    }).from(goodsDeclarations).orderBy(desc(goodsDeclarations.createdAt)),
    tdb.select({ status: goodsDeclarations.status, count: count() })
      .from(goodsDeclarations).groupBy(goodsDeclarations.status),
  ]);

  const filtered = filterStatus ? allGds.filter((g) => g.status === filterStatus) : allGds;
  const countFor = (s: string) => Number(statusCounts.find((x) => x.status === s)?.count ?? 0);

  const activeCount = allGds.filter((g) => !['cleared', 'cancelled', 'draft'].includes(g.status ?? '')).length;
  const redCount = allGds.filter((g) => g.status === 'red_channel' || g.status === 'examination_done').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customs / GD</h1>
          <p className="text-sm text-slate-500 mt-0.5">WeBOC Goods Declarations and duty management</p>
        </div>
        <Link href="/import/customs/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" /> New GD
          </Button>
        </Link>
      </div>

      {/* Red channel alert */}
      {redCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {redCount} GD{redCount > 1 ? 's' : ''} under red channel / examination — action required to prevent additional demurrage.
          </p>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'All Active', s: undefined, icon: FileText, count: activeCount, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Filed / Pending', s: 'filed', icon: Clock, count: countFor('filed'), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Red Channel', s: 'red_channel', icon: AlertTriangle, count: countFor('red_channel') + countFor('examination_done'), color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Cleared', s: 'cleared', icon: CheckCircle2, count: countFor('cleared'), color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, s, icon: Icon, count: cnt, color, bg }) => {
          const active = filterStatus === s || (!filterStatus && !s);
          return (
            <Link key={label} href={s ? `?status=${s}` : '/import/customs'}>
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
              <th className="text-left px-4 py-3 font-medium text-slate-600">GD No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Station</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Channel</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Duty Payable</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">PSID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No goods declarations found</td></tr>
            ) : filtered.map((gd) => (
              <tr key={gd.id} className={`border-b hover:bg-slate-50 ${gd.status === 'red_channel' ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3">
                  <Link href={`/import/customs/${gd.id}`} className="font-mono font-bold text-teal-700 hover:underline">
                    {gd.gdNo ?? <span className="text-slate-400 font-normal">Draft</span>}
                  </Link>
                  {gd.gdDate && <p className="text-xs text-slate-400 mt-0.5">{new Date(gd.gdDate).toLocaleDateString('en-PK')}</p>}
                </td>
                <td className="px-4 py-3 capitalize text-slate-600 text-xs">
                  {(gd.gdType ?? 'home_consumption').replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{gd.customsStation ?? '—'}</td>
                <td className="px-4 py-3">
                  {gd.channel ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${CHANNEL_BADGE[gd.channel]}`}>
                      {gd.channel}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  {gd.totalPayablePkr ? (
                    <span className="font-semibold text-slate-800">
                      ₨ {Number(gd.totalPayablePkr).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{gd.psidNo ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[gd.status ?? 'draft']}`}>
                    {(gd.status ?? 'draft').replace(/_/g, ' ')}
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
