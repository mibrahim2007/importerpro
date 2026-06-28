import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments, shipmentContainers, purchaseOrders, letterOfCredits } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { ShipmentStatusActions } from '@/components/shipments/shipment-status-actions';
import { ContainerDemurrage } from '@/components/shipments/container-demurrage';
import { DocumentArrivalTracker } from '@/components/shipments/document-arrival-tracker';
import { differenceInDays } from 'date-fns';

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'booked', label: 'Booked' },
  { key: 'sailing', label: 'Sailing' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'do_released', label: 'DO Released' },
  { key: 'customs_cleared', label: 'Customs Cleared' },
  { key: 'grn_done', label: 'GRN Done' },
];

const STATUS_COLORS: Record<string, string> = {
  draft:           'bg-slate-100 text-slate-500',
  booked:          'bg-blue-100 text-blue-600',
  sailing:         'bg-indigo-100 text-indigo-600',
  arrived:         'bg-amber-100 text-amber-700',
  do_released:     'bg-orange-100 text-orange-700',
  customs_cleared: 'bg-teal-100 text-teal-700',
  grn_done:        'bg-green-100 text-green-700',
  cancelled:       'bg-slate-100 text-slate-400',
};

const BL_TYPE_LABELS: Record<string, string> = {
  original: 'Original B/L',
  telex: 'Telex Release',
  seawaybill: 'Sea Waybill',
};

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[shp], containers] = await Promise.all([
    tdb.select().from(shipments).where(eq(shipments.id, id)).limit(1),
    tdb.select().from(shipmentContainers).where(eq(shipmentContainers.shipmentId, id)),
  ]);

  if (!shp) notFound();

  const [po, lc] = await Promise.all([
    shp.poId ? tdb.select({ poNo: purchaseOrders.poNo }).from(purchaseOrders).where(eq(purchaseOrders.id, shp.poId)).limit(1) : Promise.resolve([]),
    shp.lcId ? tdb.select({ lcNo: letterOfCredits.lcNo }).from(letterOfCredits).where(eq(letterOfCredits.id, shp.lcId)).limit(1) : Promise.resolve([]),
  ]);

  const role = session.user.role ?? '';
  const canManage = ['tenant_admin', 'procurement_manager', 'logistics_manager'].includes(role);

  const today = new Date();
  const ataDate = shp.ata ? new Date(shp.ata) : null;
  const etaDate = shp.eta ? new Date(shp.eta) : null;
  const daysAtPort = ataDate && ['arrived', 'do_released'].includes(shp.status ?? '') ? differenceInDays(today, ataDate) : null;
  const daysUntilArrival = etaDate && !ataDate ? differenceInDays(etaDate, today) : null;

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === shp.status);
  const isTerminal = ['grn_done', 'cancelled'].includes(shp.status ?? '');

  // Transit time display
  const etdDate = shp.etd ? new Date(shp.etd) : null;
  const atdDate = shp.atd ? new Date(shp.atd) : null;
  const transitDays = atdDate && ataDate ? differenceInDays(ataDate, atdDate) : (etdDate && etaDate ? differenceInDays(etaDate, etdDate) : null);

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/import/shipments">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-mono font-bold text-slate-900">{shp.shipmentNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[shp.status ?? 'draft']}`}>
                {(shp.status ?? 'draft').replace(/_/g, ' ')}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-500 capitalize">{shp.mode}</span>
              {(po as any)[0] && (
                <Link href={`/import/purchase-orders/${shp.poId}`} className="text-xs font-mono text-teal-600 hover:underline">
                  {(po as any)[0].poNo}
                </Link>
              )}
              {(lc as any)[0] && (
                <Link href={`/import/lc/${shp.lcId}`} className="text-xs font-mono text-blue-600 hover:underline">
                  {(lc as any)[0].lcNo}
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {shp.vesselName ?? '—'}{shp.voyageNo ? ` / Voy. ${shp.voyageNo}` : ''}
              {shp.shippingLineName ? ` — ${shp.shippingLineName}` : ''}
            </p>
          </div>
        </div>
        <ShipmentStatusActions shipmentId={id} status={shp.status ?? 'draft'} canManage={canManage} />
      </div>

      {/* Demurrage alert */}
      {daysAtPort !== null && daysAtPort > 7 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-300 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-700">Demurrage Alert — {daysAtPort} days at port</p>
            <p className="text-red-500 mt-0.5">Containers have exceeded standard free time. Clear customs immediately to stop accruing charges.</p>
          </div>
        </div>
      )}
      {daysUntilArrival !== null && daysUntilArrival <= 3 && daysUntilArrival >= 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 font-medium">
            ETA in {daysUntilArrival} days — ensure GD is ready and clearing agent has documents
          </p>
        </div>
      )}

      {/* Status timeline */}
      {!isTerminal && (
        <div className="flex items-center overflow-x-auto pb-1 gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= currentStepIdx;
            const current = step.key === shp.status;
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
          {/* Shipment visual timeline */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Shipping Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center overflow-x-auto gap-0 py-2">
                {[
                  { label: 'B/L Date', date: shp.blDate, done: !!shp.blDate },
                  { label: 'ETD', date: shp.etd, done: !!shp.atd || !!shp.etd, actual: shp.atd, actualLabel: 'ATD' },
                  { label: 'ETA', date: shp.eta, done: !!shp.ata || !!shp.eta, actual: shp.ata, actualLabel: 'ATA' },
                  { label: 'DO Release', date: shp.doReleasedDate, done: !!shp.doReleasedDate },
                  { label: 'GRN', date: shp.status === 'grn_done' ? 'Done' : null, done: shp.status === 'grn_done' },
                ].map((node, i, arr) => (
                  <div key={node.label} className="flex items-center">
                    <div className="text-center min-w-[90px]">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${node.done ? 'bg-teal-500' : 'bg-slate-200'}`} />
                      <p className="text-xs font-medium text-slate-600">{node.label}</p>
                      {node.actual && (
                        <p className="text-xs text-green-600 font-medium">{node.actualLabel}: {new Date(node.actual).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</p>
                      )}
                      {node.date && !node.actual && (
                        <p className="text-xs text-slate-400">{node.date === 'Done' ? 'Done' : new Date(node.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</p>
                      )}
                      {!node.date && !node.actual && <p className="text-xs text-slate-300">—</p>}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`h-px w-8 ${node.done ? 'bg-teal-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                ))}
              </div>
              {transitDays !== null && (
                <p className="text-xs text-slate-400 text-center mt-2">
                  Transit: ~{transitDays} days {atdDate && ataDate ? '(actual)' : '(estimated)'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* B/L & Vessel Details */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Shipment Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'B/L No', value: shp.blNo ?? '—', mono: true },
                { label: 'B/L Type', value: BL_TYPE_LABELS[shp.blType ?? 'original'] ?? shp.blType },
                { label: 'B/L Date', value: shp.blDate ? new Date(shp.blDate).toLocaleDateString('en-PK') : '—' },
                { label: 'Port of Loading', value: shp.portOfLoading ?? '—' },
                { label: 'Port of Discharge', value: shp.portOfDischarge ?? '—' },
                { label: 'DO No', value: shp.doNo ?? '—', mono: true },
                { label: 'Package Count', value: shp.packageCount ? String(shp.packageCount) : '—' },
                { label: 'Gross Weight', value: shp.grossWeightKg ? `${Number(shp.grossWeightKg).toLocaleString()} KG` : '—' },
                { label: 'Net Weight', value: shp.netWeightKg ? `${Number(shp.netWeightKg).toLocaleString()} KG` : '—' },
                { label: 'Volume', value: shp.volumeCbm ? `${Number(shp.volumeCbm).toFixed(3)} CBM` : '—' },
                { label: 'Freight Forwarder', value: shp.freightForwarderName ?? '—' },
                { label: 'Freight Amount', value: shp.freightAmount ? `${shp.freightCurrency} ${Number(shp.freightAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—', bold: !!shp.freightAmount },
                { label: 'Freight Payment', value: (shp.freightPayment ?? 'prepaid').toUpperCase() },
                { label: 'Freight Invoice', value: shp.freightInvoiceNo ?? '—' },
              ].map(({ label, value, mono, bold }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className={`font-medium ${bold ? 'text-teal-700' : 'text-slate-800'} ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
              {shp.notes && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Notes</p>
                  <p className="text-slate-600">{shp.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Containers */}
          <ContainerDemurrage shipmentId={id} containers={containers} ata={shp.ata} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Port dwell counter */}
          {daysAtPort !== null && (
            <Card className={daysAtPort > 7 ? 'border-red-300 bg-red-50' : 'bg-slate-800 border-0'}>
              <CardContent className="p-4 text-center">
                <p className={`text-5xl font-bold ${daysAtPort > 7 ? 'text-red-700' : 'text-white'}`}>{daysAtPort}</p>
                <p className={`text-sm mt-1 ${daysAtPort > 7 ? 'text-red-600' : 'text-slate-400'}`}>days at port</p>
                {daysAtPort > 7 && (
                  <p className="text-xs text-red-500 mt-1 font-medium">⚠️ Demurrage accruing</p>
                )}
              </CardContent>
            </Card>
          )}

          {daysUntilArrival !== null && (
            <Card className="bg-slate-800 border-0">
              <CardContent className="p-4 text-center">
                <p className={`text-5xl font-bold ${daysUntilArrival <= 3 ? 'text-amber-400' : 'text-white'}`}>{daysUntilArrival}</p>
                <p className="text-sm text-slate-400 mt-1">days until ETA</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(shp.eta!).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Document tracker */}
          <DocumentArrivalTracker
            shipmentId={id}
            blReceivedAtBank={shp.blReceivedAtBank ?? false}
            blReceivedDate={shp.blReceivedDate}
            docsReleasedByBank={shp.docsReleasedByBank ?? false}
            docsReleasedDate={shp.docsReleasedDate}
            docsSentToAgent={shp.docsSentToAgent ?? false}
            docsSentDate={shp.docsSentDate}
            courierTrackingNo={shp.courierTrackingNo}
          />
        </div>
      </div>
    </div>
  );
}
