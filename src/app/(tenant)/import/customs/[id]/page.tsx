import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { goodsDeclarations, gdLines, shipments } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { GdStatusActions } from '@/components/customs/gd-status-actions';

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'filed', label: 'Filed' },
  { key: 'channel', label: 'Channelled' },
  { key: 'assessment_ordered', label: 'AO Issued' },
  { key: 'duty_paid', label: 'Duty Paid' },
  { key: 'cleared', label: 'Cleared' },
];

const STATUS_COLORS: Record<string, string> = {
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

const CHANNEL_COLORS: Record<string, string> = {
  green:  'text-green-700 bg-green-50 border-green-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  red:    'text-red-700 bg-red-50 border-red-200',
};

const GD_TYPE_LABELS: Record<string, string> = {
  home_consumption: 'Home Consumption (HC)',
  warehousing: 'Warehousing (WH)',
  transit: 'Transit',
};

function fmt(n: string | null | undefined) {
  if (!n) return '—';
  return '₨ ' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function pct(n: string | null | undefined) {
  if (!n || Number(n) === 0) return null;
  return Number(n).toFixed(2) + '%';
}

// Map GD status to which progress step it belongs
function statusToStepIdx(status: string): number {
  if (status === 'draft') return 0;
  if (status === 'filed') return 1;
  if (['green_channel', 'yellow_channel', 'red_channel', 'query_raised', 'query_replied', 'examination_done'].includes(status)) return 2;
  if (status === 'assessment_ordered') return 3;
  if (status === 'duty_paid') return 4;
  if (status === 'cleared') return 5;
  return 0;
}

export default async function GdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[gd], lines] = await Promise.all([
    tdb.select().from(goodsDeclarations).where(eq(goodsDeclarations.id, id)).limit(1),
    tdb.select().from(gdLines).where(eq(gdLines.gdId, id)).orderBy(asc(gdLines.sortOrder)),
  ]);

  if (!gd) notFound();

  const shipmentRecord = gd.shipmentId
    ? await tdb.select({ shipmentNo: shipments.shipmentNo }).from(shipments).where(eq(shipments.id, gd.shipmentId)).limit(1)
    : [];

  const role = session.user.role ?? '';
  const canManage = ['tenant_admin', 'procurement_manager', 'logistics_manager', 'finance_manager'].includes(role);

  const currentStepIdx = statusToStepIdx(gd.status ?? 'draft');
  const isTerminal = ['cleared', 'cancelled'].includes(gd.status ?? '');

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/import/customs">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-mono font-bold text-slate-900">
                {gd.gdNo ?? <span className="text-slate-400 font-normal italic text-base">Not Filed</span>}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[gd.status ?? 'draft']}`}>
                {(gd.status ?? 'draft').replace(/_/g, ' ')}
              </span>
              {gd.channel && (
                <span className={`px-2.5 py-1 rounded border text-xs font-semibold capitalize ${CHANNEL_COLORS[gd.channel]}`}>
                  {gd.channel} channel
                </span>
              )}
              {(shipmentRecord as any)[0] && (
                <Link href={`/import/shipments/${gd.shipmentId}`} className="text-xs font-mono text-teal-600 hover:underline">
                  {(shipmentRecord as any)[0].shipmentNo}
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {GD_TYPE_LABELS[gd.gdType ?? 'home_consumption']}
              {gd.customsStation ? ` — ${gd.customsStation}` : ''}
              {gd.gdDate ? ` — ${new Date(gd.gdDate).toLocaleDateString('en-PK')}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <GdStatusActions gdId={id} status={gd.status ?? 'draft'} canManage={canManage} />

      {/* Alerts */}
      {gd.status === 'red_channel' && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-700">Red Channel — Physical Examination Required</p>
            <p className="text-red-500 mt-0.5">Coordinate with clearing agent for examination appointment. Record findings to proceed to Assessment Order.</p>
          </div>
        </div>
      )}
      {gd.status === 'query_raised' && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-orange-200 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-orange-700">Customs Query Raised</p>
            {gd.queryText && <p className="text-orange-600 mt-1 italic">{gd.queryText}</p>}
            {gd.queryRaisedDate && <p className="text-xs text-orange-400 mt-1">Raised: {new Date(gd.queryRaisedDate).toLocaleDateString('en-PK')}</p>}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {!isTerminal && (
        <div className="flex items-center overflow-x-auto pb-1 gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= currentStepIdx;
            const current = i === currentStepIdx;
            return (
              <div key={step.key} className="flex items-center">
                <div className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
                  current ? 'bg-teal-600 text-white' : done ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {step.label}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-px w-4 ${done ? 'bg-teal-300' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* GD Details */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">GD Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'GD No', value: gd.gdNo ?? '—', mono: true },
                { label: 'GD Type', value: GD_TYPE_LABELS[gd.gdType ?? 'home_consumption'] },
                { label: 'Customs Station', value: gd.customsStation ?? '—' },
                { label: 'Clearing Agent', value: gd.clearingAgentName ?? '—' },
                { label: 'NTN', value: gd.ntn ?? '—', mono: true },
                { label: 'STRN', value: gd.strn ?? '—', mono: true },
                { label: 'Import Reg. No', value: gd.importRegNo ?? '—' },
                { label: 'Exchange Rate', value: gd.exchangeRate ? `₨ ${Number(gd.exchangeRate).toFixed(2)} / USD` : '—' },
                { label: 'SROs Applied', value: gd.srosApplied ?? '—' },
              ].map(({ label, value, mono }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className={`font-medium text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
                </div>
              ))}
              {gd.notes && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Notes</p>
                  <p className="text-slate-600">{gd.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* GD Lines */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">GD Lines & Duty Breakdown</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">HS Code</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">CIF (PKR)</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">CD</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">ST</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600 bg-red-50">Total Duty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-mono">{l.hsCode}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-800">{l.commodityDescription}</p>
                          <p className="text-slate-400">{l.qty ? `${l.qty} ${l.uom ?? ''}` : ''} {l.countryOfOrigin ? `· ${l.countryOfOrigin}` : ''}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{fmt(l.cifValuePkr)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <p>{fmt(l.customsDutyPkr)}</p>
                          {pct(l.customsDutyPct) && <p className="text-slate-400">@{pct(l.customsDutyPct)}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <p>{fmt(l.salesTaxPkr)}</p>
                          {pct(l.salesTaxPct) && <p className="text-slate-400">@{pct(l.salesTaxPct)}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-red-700 bg-red-50">{fmt(l.totalDutyPkr)}</td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No line items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Examination details (if red channel) */}
          {gd.examinationDate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4" /> Examination Record
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  { label: 'Date', value: new Date(gd.examinationDate).toLocaleDateString('en-PK') },
                  { label: 'Officer', value: gd.examinationOfficer ?? '—' },
                  { label: 'Location', value: gd.examinationLocation ?? '—' },
                  { label: 'Report No', value: gd.examinationReportNo ?? '—', mono: true },
                  { label: 'Findings', value: (gd.examinationFindings ?? '—').replace(/_/g, ' '), highlight: gd.examinationFindings !== 'clear' },
                  { label: 'Exam Charges', value: gd.examinationChargesPkr ? fmt(gd.examinationChargesPkr) : '—' },
                ].map(({ label, value, mono, highlight }) => (
                  <div key={label} className="space-y-0.5">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className={`font-medium capitalize ${highlight ? 'text-red-600' : 'text-slate-800'} ${mono ? 'font-mono' : ''}`}>{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Query log */}
          {gd.queryText && (
            <Card className="border-orange-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-700">Customs Query Log</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 bg-orange-50 rounded">
                  <p className="font-medium text-orange-800">{gd.queryText}</p>
                  {gd.queryRaisedDate && <p className="text-xs text-orange-400 mt-1">Raised: {new Date(gd.queryRaisedDate).toLocaleDateString('en-PK')}</p>}
                </div>
                {gd.queryReply && (
                  <div className="p-3 bg-amber-50 rounded border-l-2 border-amber-400">
                    <p className="font-medium text-amber-800">{gd.queryReply}</p>
                    {gd.queryRepliedDate && <p className="text-xs text-amber-400 mt-1">Replied: {new Date(gd.queryRepliedDate).toLocaleDateString('en-PK')}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Duty summary */}
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Duty Summary</p>
              {[
                { label: 'Assessable Value', value: fmt(gd.totalAssessableValuePkr), color: 'text-slate-300' },
                { label: 'Customs Duty', value: fmt(gd.totalCustomsDutyPkr), color: 'text-blue-300' },
                { label: 'Sales Tax', value: fmt(gd.totalSalesTaxPkr), color: 'text-amber-300' },
                { label: 'Other Duties', value: fmt(gd.totalOtherDutyPkr), color: 'text-slate-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className={`font-medium ${color}`}>{value}</span>
                </div>
              ))}
              <div className="border-t border-slate-600 pt-3 flex justify-between">
                <span className="text-sm text-white font-semibold">Total Payable</span>
                <span className="text-lg font-bold text-red-300">{fmt(gd.totalPayablePkr)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Assessment Order */}
          {gd.aoNo && (
            <Card className="border-indigo-200 bg-indigo-50">
              <CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold text-indigo-800">Assessment Order</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-indigo-500">AO No</span><span className="font-mono text-indigo-800">{gd.aoNo}</span></div>
                  {gd.aoDate && <div className="flex justify-between"><span className="text-indigo-500">Date</span><span>{new Date(gd.aoDate).toLocaleDateString('en-PK')}</span></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PSID */}
          {gd.psidNo && (
            <Card className="border-teal-200 bg-teal-50">
              <CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold text-teal-800 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Duty Paid</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-teal-500">PSID No</span><span className="font-mono text-teal-800 text-xs">{gd.psidNo}</span></div>
                  {gd.psidDate && <div className="flex justify-between"><span className="text-teal-500">Date</span><span>{new Date(gd.psidDate).toLocaleDateString('en-PK')}</span></div>}
                  {gd.psidBankName && <div className="flex justify-between"><span className="text-teal-500">Bank</span><span>{gd.psidBankName}</span></div>}
                  {gd.psidAmountPkr && <div className="flex justify-between"><span className="text-teal-500">Amount</span><span className="font-bold text-teal-700">{fmt(gd.psidAmountPkr)}</span></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cleared */}
          {gd.status === 'cleared' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-700">Customs Cleared</p>
                  {gd.gdClearedDate && <p className="text-xs text-green-500 mt-0.5">{new Date(gd.gdClearedDate).toLocaleDateString('en-PK')}</p>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
