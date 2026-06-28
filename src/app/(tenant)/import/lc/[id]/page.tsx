import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { letterOfCredits, lcAmendments, lcCharges, lcDocuments, suppliers, purchaseOrders } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, Building2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { LcStatusActions } from '@/components/lc/lc-status-actions';
import { LcDocumentChecklist } from '@/components/lc/lc-document-checklist';
import { LcChargesPanel } from '@/components/lc/lc-charges-panel';
import { differenceInDays } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft:               'bg-slate-100 text-slate-600',
  applied:             'bg-blue-100 text-blue-700',
  opened:              'bg-indigo-100 text-indigo-700',
  documents_presented: 'bg-amber-100 text-amber-700',
  under_scrutiny:      'bg-orange-100 text-orange-700',
  accepted:            'bg-teal-100 text-teal-700',
  retired:             'bg-green-100 text-green-700',
  expired:             'bg-red-100 text-red-500',
  cancelled:           'bg-slate-100 text-slate-400',
};

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'applied', label: 'Applied' },
  { key: 'opened', label: 'Opened' },
  { key: 'documents_presented', label: 'Docs Presented' },
  { key: 'under_scrutiny', label: 'Under Scrutiny' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'retired', label: 'Retired' },
];

const LC_TYPE_LABELS: Record<string, string> = {
  sight: 'Sight LC',
  usance_30: 'Usance 30d',
  usance_60: 'Usance 60d',
  usance_90: 'Usance 90d',
  usance_120: 'Usance 120d',
  usance_180: 'Usance 180d',
};

export default async function LcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[lc], amendments, charges, documents] = await Promise.all([
    tdb.select().from(letterOfCredits).where(eq(letterOfCredits.id, id)).limit(1),
    tdb.select().from(lcAmendments).where(eq(lcAmendments.lcId, id)).orderBy(asc(lcAmendments.amendmentNo)),
    tdb.select().from(lcCharges).where(eq(lcCharges.lcId, id)).orderBy(asc(lcCharges.createdAt)),
    tdb.select().from(lcDocuments).where(eq(lcDocuments.lcId, id)).orderBy(asc(lcDocuments.documentType)),
  ]);

  if (!lc) notFound();

  const [supplier, po] = await Promise.all([
    tdb.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, lc.supplierId)).limit(1),
    lc.poId ? tdb.select({ poNo: purchaseOrders.poNo }).from(purchaseOrders).where(eq(purchaseOrders.id, lc.poId)).limit(1) : Promise.resolve([]),
  ]);

  const role = session.user.role ?? '';
  const canManage = ['tenant_admin', 'procurement_manager', 'finance_manager'].includes(role);

  const daysToExpiry = lc.expiryDate ? differenceInDays(new Date(lc.expiryDate), new Date()) : null;
  const isExpirySoon = daysToExpiry !== null && daysToExpiry <= 14 && daysToExpiry >= 0;
  const isExpired = daysToExpiry !== null && daysToExpiry < 0;

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === lc.status);
  const isTerminal = ['retired', 'expired', 'cancelled'].includes(lc.status ?? '');

  const totalChargesPkr = charges.filter((c) => (c.currency ?? 'PKR') === 'PKR').reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/import/lc">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-mono font-bold text-slate-900">{lc.lcNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lc.status ?? 'draft']}`}>
                {(lc.status ?? 'draft').replace(/_/g, ' ')}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-600">
                {LC_TYPE_LABELS[lc.lcType ?? 'sight'] ?? lc.lcType}
              </span>
              {(po as any)[0] && (
                <Link href={`/import/purchase-orders/${lc.poId}`} className="text-xs font-mono text-teal-600 hover:underline">
                  {(po as any)[0].poNo}
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{(supplier as any)[0]?.name ?? '—'}</p>
          </div>
        </div>
        <LcStatusActions lcId={id} status={lc.status ?? 'draft'} canManage={canManage} />
      </div>

      {/* Expiry alert */}
      {isExpirySoon && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-700">LC expires in {daysToExpiry} days</p>
            <p className="text-red-500 mt-0.5">Expiry: {new Date(lc.expiryDate!).toLocaleDateString('en-PK')} — consider requesting an amendment if needed.</p>
          </div>
        </div>
      )}
      {isExpired && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-300 bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-700">This LC has passed its expiry date ({new Date(lc.expiryDate!).toLocaleDateString('en-PK')})</p>
        </div>
      )}

      {/* Status progress bar */}
      {!isTerminal && (
        <div className="flex items-center overflow-x-auto pb-1 gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= currentStepIdx;
            const current = step.key === lc.status;
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
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* LC Details */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">LC Terms</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'LC Amount', value: `${lc.currency} ${Number(lc.lcAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, bold: true },
                { label: 'Incoterms', value: lc.incoterms ?? '—' },
                { label: 'Issuing Bank', value: lc.issuingBank },
                { label: 'Advising Bank', value: lc.advisingBank ?? '—' },
                { label: 'SWIFT Ref (MT700)', value: lc.swiftRef ?? '—' },
                { label: 'Presentation Period', value: `${lc.presentationDays ?? 21} days after BL` },
                { label: 'Opening Date', value: lc.openingDate ? new Date(lc.openingDate).toLocaleDateString('en-PK') : '—' },
                { label: 'Expiry Date', value: lc.expiryDate ? new Date(lc.expiryDate).toLocaleDateString('en-PK') : '—', highlight: isExpirySoon },
                { label: 'Latest Ship Date', value: lc.latestShipDate ? new Date(lc.latestShipDate).toLocaleDateString('en-PK') : '—' },
                { label: 'Port of Loading', value: lc.portOfLoading ?? '—' },
                { label: 'Port of Discharge', value: lc.portOfDischarge ?? '—' },
                { label: 'Partial Shipment', value: lc.partialShipment ? 'Allowed' : 'Not Allowed' },
                { label: 'Transhipment', value: lc.transhipment ? 'Allowed' : 'Not Allowed' },
                { label: 'Scrutiny Status', value: (lc.scrutinyStatus ?? 'pending').replace(/_/g, ' ') },
              ].map(({ label, value, bold, highlight }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className={`font-medium ${bold ? 'text-teal-700 text-base' : highlight ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
                </div>
              ))}
              {lc.specialTerms && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Special Terms</p>
                  <p className="text-slate-600">{lc.specialTerms}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Checklist */}
          <LcDocumentChecklist lcId={id} docs={documents} />

          {/* Amendment Log */}
          {amendments.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Amendments ({amendments.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Amdt #</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Field</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Old</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">New</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Reason</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amendments.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-indigo-600">A{a.amendmentNo}</td>
                        <td className="px-4 py-2.5 capitalize text-slate-600">{a.fieldChanged.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2.5 text-red-500 text-xs">{a.oldValue ?? '—'}</td>
                        <td className="px-4 py-2.5 text-green-600 text-xs font-medium">{a.newValue}</td>
                        <td className="px-4 py-2.5 text-slate-500 italic text-xs">{a.reason}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">
                          {a.approvedDate ? new Date(a.approvedDate).toLocaleDateString('en-PK') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar — charges + key dates */}
        <div className="space-y-4">
          {/* Expiry countdown */}
          {daysToExpiry !== null && !isTerminal && (
            <Card className={`${isExpirySoon ? 'border-red-300 bg-red-50' : isExpired ? 'border-red-400 bg-red-100' : 'bg-slate-800 border-0'}`}>
              <CardContent className="p-4 text-center">
                {isExpired ? (
                  <>
                    <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-700 font-bold">LC Expired</p>
                  </>
                ) : (
                  <>
                    <Clock className={`h-8 w-8 mx-auto mb-2 ${isExpirySoon ? 'text-red-500' : 'text-teal-400'}`} />
                    <p className={`text-4xl font-bold ${isExpirySoon ? 'text-red-700' : 'text-white'}`}>{daysToExpiry}</p>
                    <p className={`text-sm mt-1 ${isExpirySoon ? 'text-red-600' : 'text-slate-400'}`}>days until expiry</p>
                    <p className={`text-xs mt-1 ${isExpirySoon ? 'text-red-500' : 'text-slate-500'}`}>
                      {new Date(lc.expiryDate!).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Charges */}
          <LcChargesPanel lcId={id} charges={charges} />

          {/* Quick actions for confirmed */}
          {lc.status === 'retired' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-green-700">LC Retired</p>
                  {lc.retiredDate && <p className="text-green-600 text-xs mt-0.5">{new Date(lc.retiredDate).toLocaleDateString('en-PK')}</p>}
                  {totalChargesPkr > 0 && (
                    <p className="text-green-500 text-xs mt-1">Total bank charges: ₨ {totalChargesPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
