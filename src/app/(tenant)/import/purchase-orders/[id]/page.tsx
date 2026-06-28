import { auth } from '@/lib/auth/config';
import { getTenantDb, db } from '@/db';
import { purchaseOrders, poLines, poAmendments, products, suppliers, rfqs, indents, users } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, MapPin, Building2, FileText, Anchor } from 'lucide-react';
import { PoStatusActions } from '@/components/po/po-status-actions';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-blue-100 text-blue-700',
  lc_requested: 'bg-indigo-100 text-indigo-700',
  lc_opened: 'bg-violet-100 text-violet-700',
  goods_dispatched: 'bg-amber-100 text-amber-700',
  partially_received: 'bg-orange-100 text-orange-700',
  fully_received: 'bg-green-100 text-green-700',
  invoiced: 'bg-teal-100 text-teal-700',
  closed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-400',
};

const STATUS_STEPS = [
  'draft', 'confirmed', 'lc_requested', 'lc_opened',
  'goods_dispatched', 'partially_received', 'fully_received', 'invoiced', 'closed',
];

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  lc_sight: 'LC at Sight', lc_30: 'LC 30 days', lc_60: 'LC 60 days', lc_90: 'LC 90 days',
  tt_advance: 'TT Advance', cad: 'CAD', cash: 'Cash',
  net_15: 'Net 15', net_30: 'Net 30', net_45: 'Net 45', net_60: 'Net 60', net_90: 'Net 90',
};

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[po], lines, amendments] = await Promise.all([
    tdb.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1),
    tdb.select({ line: poLines, product: products })
      .from(poLines)
      .leftJoin(products, eq(poLines.productId, products.id))
      .where(eq(poLines.poId, id))
      .orderBy(asc(poLines.sortOrder)),
    tdb.select().from(poAmendments)
      .where(eq(poAmendments.poId, id))
      .orderBy(asc(poAmendments.amendmentNo)),
  ]);

  if (!po) notFound();

  const [supplier, rfq, indent] = await Promise.all([
    tdb.select({ name: suppliers.name, code: suppliers.code }).from(suppliers).where(eq(suppliers.id, po.supplierId)).limit(1),
    po.rfqId ? tdb.select({ rfqNo: rfqs.rfqNo }).from(rfqs).where(eq(rfqs.id, po.rfqId)).limit(1) : Promise.resolve([]),
    po.indentId ? tdb.select({ indentNo: indents.indentNo }).from(indents).where(eq(indents.id, po.indentId)).limit(1) : Promise.resolve([]),
  ]);

  const role = session.user.role ?? '';
  const canManage = ['tenant_admin', 'procurement_manager', 'finance_manager'].includes(role);

  const currentStepIdx = STATUS_STEPS.indexOf(po.status ?? 'draft');

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/import/purchase-orders">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-mono font-bold text-slate-900">{po.poNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status ?? 'draft']}`}>
                {(po.status ?? 'draft').replace(/_/g, ' ')}
              </span>
              {(rfq as any)[0] && (
                <Link href={`/import/rfqs/${po.rfqId}`}
                  className="text-xs text-teal-600 font-mono hover:underline">
                  {(rfq as any)[0].rfqNo}
                </Link>
              )}
              {(indent as any)[0] && (
                <Link href={`/import/indents/${po.indentId}`}
                  className="text-xs text-slate-400 font-mono hover:text-slate-600">
                  {(indent as any)[0].indentNo}
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {(supplier as any)[0]?.name ?? '—'}
            </p>
          </div>
        </div>
        <PoStatusActions poId={id} status={po.status ?? 'draft'} canManage={canManage} />
      </div>

      {/* Status progress bar */}
      {po.status !== 'cancelled' && (
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {STATUS_STEPS.filter((s) => s !== 'invoiced' && s !== 'closed').map((step, i) => {
            const stepIdx = STATUS_STEPS.indexOf(step);
            const done = stepIdx <= currentStepIdx;
            const current = step === po.status;
            return (
              <div key={step} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
                  current ? 'bg-teal-600 text-white' :
                  done ? 'bg-teal-100 text-teal-700' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {step.replace(/_/g, ' ')}
                </div>
                {i < STATUS_STEPS.filter((s) => s !== 'invoiced' && s !== 'closed').length - 1 && (
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
          {/* Commercial terms */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Commercial Terms</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'PO Date', value: po.poDate ? new Date(po.poDate).toLocaleDateString('en-PK') : '—', icon: Calendar },
                { label: 'Supplier', value: (supplier as any)[0]?.name ?? '—', icon: Building2 },
                { label: 'Incoterms', value: po.incoterms ?? '—', icon: FileText },
                { label: 'Payment Terms', value: PAYMENT_TERMS_LABEL[po.paymentTerms ?? ''] ?? po.paymentTerms ?? '—', icon: FileText },
                { label: 'Port of Loading', value: po.portOfLoading ?? '—', icon: MapPin },
                { label: 'Port of Discharge', value: po.portOfDischarge ?? '—', icon: MapPin },
                { label: 'Currency', value: `${po.currency ?? 'USD'} (Rate: ${po.exchangeRate ?? '—'} PKR)`, icon: FileText },
                { label: 'Latest Ship Date', value: po.latestShipDate ? new Date(po.latestShipDate).toLocaleDateString('en-PK') : '—', icon: Calendar },
                { label: 'LC Expiry Date', value: po.lcExpiryDate ? new Date(po.lcExpiryDate).toLocaleDateString('en-PK') : '—', icon: Anchor },
                { label: 'Issuing Bank', value: po.bankIssuingLc ?? '—', icon: Building2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    {value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Line Items ({lines.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">#</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Product</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">HS Code</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Qty</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">UOM</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Unit Price</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ line, product }, i) => (
                    <tr key={line.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{product?.name ?? '—'}</p>
                        {product?.code && <p className="text-xs text-slate-400 font-mono">{product.code}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{line.hsCode ?? product?.hsCode ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{Number(line.qty).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{line.uom ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {po.currency} {Number(line.unitPrice).toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {po.currency} {Number(line.totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Amendments */}
          {amendments.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Amendment Log</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Amdt #</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Field</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Old Value</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">New Value</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Reason</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amendments.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600">A{a.amendmentNo}</td>
                        <td className="px-4 py-3 text-slate-600 capitalize">{a.fieldChanged.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-red-500 text-xs">{a.oldValue ?? '—'}</td>
                        <td className="px-4 py-3 text-green-600 text-xs font-medium">{a.newValue}</td>
                        <td className="px-4 py-3 text-slate-500 italic text-xs">{a.reason}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-PK') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — financial summary */}
        <div className="space-y-4">
          <Card className="bg-slate-800 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Subtotal', value: `${po.currency} ${Number(po.subtotalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                { label: 'Freight', value: `${po.currency} ${Number(po.freightAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                { label: 'Insurance', value: `${po.currency} ${Number(po.insuranceAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-200">{value}</span>
                </div>
              ))}
              <div className="border-t border-slate-600 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">CIF Value ({po.currency})</span>
                  <span className="text-white font-bold text-base">
                    {Number(po.cifValueUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {po.cifValuePkr && (
                  <div className="flex justify-between mt-2">
                    <span className="text-slate-400 text-sm">CIF Value (PKR)</span>
                    <span className="text-teal-300 font-semibold">
                      ₨ {Number(po.cifValuePkr).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          {(po.packingInstructions || po.markingInstructions || po.specialConditions) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Shipping Instructions</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {po.packingInstructions && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Packing</p>
                    <p className="text-slate-700">{po.packingInstructions}</p>
                  </div>
                )}
                {po.markingInstructions && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Marking</p>
                    <p className="text-slate-700">{po.markingInstructions}</p>
                  </div>
                )}
                {po.specialConditions && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Special Conditions</p>
                    <p className="text-slate-700">{po.specialConditions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
