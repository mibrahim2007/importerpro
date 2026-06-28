import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { grns, grnLines, products, warehouses, stockLocations, shipments, goodsDeclarations, purchaseOrders } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import { GrnStatusActions } from '@/components/grn/grn-status-actions';

const STATUS_COLORS: Record<string, string> = {
  draft:       'bg-slate-100 text-slate-500',
  posted:      'bg-teal-100 text-teal-700',
  qc_hold:     'bg-amber-100 text-amber-700',
  qc_released: 'bg-green-100 text-green-700',
  cancelled:   'bg-slate-100 text-slate-400',
};

const QC_BADGE: Record<string, string> = {
  accepted:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-600',
  under_qc:  'bg-amber-100 text-amber-700',
};

const CONDITION_BADGE: Record<string, string> = {
  good:    'text-green-600',
  damaged: 'text-red-600',
  wet:     'text-blue-600',
  short:   'text-amber-600',
};

export default async function GrnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[grn], lines] = await Promise.all([
    tdb.select().from(grns).where(eq(grns.id, id)).limit(1),
    tdb.select().from(grnLines).where(eq(grnLines.grnId, id)).orderBy(asc(grnLines.sortOrder)),
  ]);

  if (!grn) notFound();

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const locationIds = [...new Set(lines.map((l) => l.storageLocationId).filter(Boolean))] as string[];

  const [productRows, warehouseRow, locationRows, shipmentRow, gdRow, poRow] = await Promise.all([
    productIds.length > 0
      ? tdb.select({ id: products.id, name: products.name, code: products.code }).from(products).where(eq(products.id, productIds[0])).limit(productIds.length)
      : Promise.resolve([]) as any,
    tdb.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.id, grn.warehouseId)).limit(1),
    locationIds.length > 0
      ? tdb.select({ id: stockLocations.id, name: stockLocations.name }).from(stockLocations).where(eq(stockLocations.id, locationIds[0])).limit(locationIds.length)
      : Promise.resolve([]) as any,
    grn.shipmentId ? tdb.select({ shipmentNo: shipments.shipmentNo }).from(shipments).where(eq(shipments.id, grn.shipmentId)).limit(1) : Promise.resolve([]),
    grn.gdId ? tdb.select({ gdNo: goodsDeclarations.gdNo }).from(goodsDeclarations).where(eq(goodsDeclarations.id, grn.gdId)).limit(1) : Promise.resolve([]),
    grn.poId ? tdb.select({ poNo: purchaseOrders.poNo }).from(purchaseOrders).where(eq(purchaseOrders.id, grn.poId)).limit(1) : Promise.resolve([]),
  ]);

  const prodMap = Object.fromEntries((productRows as any[]).map((p: any) => [p.id, p]));
  const locMap = Object.fromEntries((locationRows as any[]).map((l: any) => [l.id, l.name]));

  const role = session.user.role ?? '';
  const canManage = ['tenant_admin', 'store_manager', 'warehouse_manager', 'procurement_manager'].includes(role);

  const qcLines = lines.filter((l) => l.qualityStatus === 'under_qc').map((l) => ({
    id: l.id,
    productName: prodMap[l.productId]?.name ?? l.productId,
    receivedQty: l.receivedQty ?? '0',
    uom: l.uom,
    qualityStatus: l.qualityStatus ?? 'under_qc',
  }));

  const totalReceived = lines.reduce((s, l) => s + Number(l.receivedQty ?? 0), 0);
  const totalAccepted = lines.filter((l) => l.qualityStatus === 'accepted').reduce((s, l) => s + Number(l.receivedQty ?? 0), 0);
  const totalRejected = lines.filter((l) => l.qualityStatus === 'rejected').reduce((s, l) => s + Number(l.receivedQty ?? 0), 0);
  const hasShortage = lines.some((l) => l.orderedQty && Number(l.receivedQty) < Number(l.orderedQty));
  const hasExcess = lines.some((l) => l.orderedQty && Number(l.receivedQty) > Number(l.orderedQty));

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/import/grn">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-mono font-bold text-slate-900">{grn.grnNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[grn.status ?? 'draft']}`}>
                {(grn.status ?? 'draft').replace(/_/g, ' ')}
              </span>
              {(poRow as any)[0] && (
                <Link href={`/import/purchase-orders/${grn.poId}`} className="text-xs font-mono text-teal-600 hover:underline">
                  {(poRow as any)[0].poNo}
                </Link>
              )}
              {(shipmentRow as any)[0] && (
                <Link href={`/import/shipments/${grn.shipmentId}`} className="text-xs font-mono text-indigo-600 hover:underline">
                  {(shipmentRow as any)[0].shipmentNo}
                </Link>
              )}
              {(gdRow as any)[0] && (
                <Link href={`/import/customs/${grn.gdId}`} className="text-xs font-mono text-slate-600 hover:underline">
                  {(gdRow as any)[0].gdNo ?? 'GD'}
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {(warehouseRow as any)[0]?.name ?? '—'}
              {grn.grnDate ? ` — ${new Date(grn.grnDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Status actions */}
      <GrnStatusActions grnId={id} status={grn.status ?? 'draft'} canManage={canManage} qcLines={qcLines} />

      {/* Alerts */}
      {grn.status === 'qc_hold' && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700">QC Hold — {qcLines.length} line{qcLines.length > 1 ? 's' : ''} pending quality decision</p>
            <p className="text-amber-600 mt-0.5">Accepted lines have been stocked. QC hold lines are quarantined until released.</p>
          </div>
        </div>
      )}
      {(hasShortage || hasExcess) && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-orange-200 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-700 font-medium">
            {hasShortage && 'Short receipt detected — quantity received is less than ordered. '}
            {hasExcess && 'Excess receipt detected — quantity received exceeds ordered.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Receipt info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Receipt Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'GRN Date', value: new Date(grn.grnDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) },
                { label: 'Warehouse', value: (warehouseRow as any)[0]?.name ?? '—' },
                { label: 'Vehicle No', value: grn.vehicleNo ?? '—' },
                { label: 'Driver Name', value: grn.driverName ?? '—' },
                { label: 'Delivery Challan', value: grn.deliveryChallanNo ?? '—', mono: true },
                { label: 'Posted At', value: grn.postedAt ? new Date(grn.postedAt).toLocaleString('en-PK') : '—' },
              ].map(({ label, value, mono }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className={`font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
              {grn.notes && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Notes</p>
                  <p className="text-slate-600">{grn.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Line Items ({lines.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Product</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Ordered</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Received</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Diff</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Lot / Batch</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Location</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">QC</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const prod = prodMap[l.productId];
                      const ordered = l.orderedQty ? Number(l.orderedQty) : null;
                      const received = Number(l.receivedQty ?? 0);
                      const diff = ordered !== null ? received - ordered : null;
                      return (
                        <tr key={l.id} className={`border-b ${l.qualityStatus === 'under_qc' ? 'bg-amber-50' : l.qualityStatus === 'rejected' ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{prod?.name ?? l.productId}</p>
                            {prod?.code && <p className="text-xs text-slate-400 font-mono">{prod.code}</p>}
                            {l.hsCode && <p className="text-xs text-slate-400 font-mono">{l.hsCode}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {ordered !== null ? `${ordered} ${l.uom ?? ''}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {received} {l.uom ?? ''}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-medium">
                            {diff !== null && diff !== 0 ? (
                              <span className={diff < 0 ? 'text-red-600' : 'text-amber-600'}>
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            ) : diff === 0 ? <span className="text-green-500">✓</span> : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            <p>{l.lotBatchNo ?? '—'}</p>
                            {l.expiryDate && <p className="text-slate-400">Exp: {new Date(l.expiryDate).toLocaleDateString('en-PK')}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {l.storageLocationId ? locMap[l.storageLocationId] ?? '—' : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${QC_BADGE[l.qualityStatus ?? 'accepted']}`}>
                              {(l.qualityStatus ?? 'accepted').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium capitalize ${CONDITION_BADGE[l.conditionOnReceipt ?? 'good']}`}>
                              {l.conditionOnReceipt ?? 'good'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Receipt summary */}
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Receipt Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Lines</span>
                  <span className="text-white font-medium">{lines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Received</span>
                  <span className="text-white font-medium">{totalReceived.toLocaleString()}</span>
                </div>
                {totalAccepted > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Accepted</span>
                    <span className="text-green-400 font-medium">{totalAccepted.toLocaleString()}</span>
                  </div>
                )}
                {totalRejected > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rejected</span>
                    <span className="text-red-400 font-medium">{totalRejected.toLocaleString()}</span>
                  </div>
                )}
                {qcLines.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Under QC</span>
                    <span className="text-amber-400 font-medium">{qcLines.length} line{qcLines.length > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stock updated confirmation */}
          {['posted', 'qc_released'].includes(grn.status ?? '') && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex gap-3">
                <PackageCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-700 text-sm">Stock Updated</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {grn.postedAt ? `Posted ${new Date(grn.postedAt).toLocaleString('en-PK')}` : ''}
                  </p>
                  {grn.status === 'qc_released' && grn.qcReleasedAt && (
                    <p className="text-xs text-green-500 mt-0.5">QC Released {new Date(grn.qcReleasedAt).toLocaleString('en-PK')}</p>
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
