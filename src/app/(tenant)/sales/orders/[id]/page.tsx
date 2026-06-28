import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import {
  salesOrders, salesOrderLines, stockReservations,
  customers, products, warehouses,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Shield } from 'lucide-react';
import { SoActions } from '@/components/sales/so-actions';

export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  pending_approval: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-teal-100 text-teal-700',
  partially_dispatched: 'bg-blue-100 text-blue-700',
  fully_dispatched: 'bg-indigo-100 text-indigo-700',
  invoiced: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-400',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_approval: 'Credit Hold', confirmed: 'Confirmed',
  partially_dispatched: 'Partially Dispatched', fully_dispatched: 'Fully Dispatched',
  invoiced: 'Invoiced', closed: 'Closed', cancelled: 'Cancelled',
};

const pkr = (v: string | null | undefined) =>
  v ? `PKR ${parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '—';

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[so], lines, reservations] = await Promise.all([
    tdb.select({
      id: salesOrders.id, soNo: salesOrders.soNo, soDate: salesOrders.soDate,
      status: salesOrders.status, creditCheck: salesOrders.creditCheck,
      paymentTerms: salesOrders.paymentTerms,
      requestedDeliveryDate: salesOrders.requestedDeliveryDate,
      promisedDeliveryDate: salesOrders.promisedDeliveryDate,
      internalNotes: salesOrders.internalNotes,
      subtotalPkr: salesOrders.subtotalPkr, salesTaxPkr: salesOrders.salesTaxPkr,
      whtPkr: salesOrders.whtPkr, grandTotalPkr: salesOrders.grandTotalPkr,
      outstandingBalancePkr: salesOrders.outstandingBalancePkr,
      creditLimitPkr: salesOrders.creditLimitPkr,
      approvedAt: salesOrders.approvedAt, approvalNote: salesOrders.approvalNote,
      cancellationReason: salesOrders.cancellationReason,
      quotationId: salesOrders.quotationId, createdAt: salesOrders.createdAt,
      customerId: salesOrders.customerId, warehouseId: salesOrders.warehouseId,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, whtRatePct: customers.whtRatePct,
      customerBillingAddress: customers.billingAddress, customerPhone: customers.phone,
    })
    .from(salesOrders)
    .leftJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(eq(salesOrders.id, id)).limit(1),

    tdb.select({
      id: salesOrderLines.id, orderedQty: salesOrderLines.orderedQty,
      uom: salesOrderLines.uom, unitPricePkr: salesOrderLines.unitPricePkr,
      discountPct: salesOrderLines.discountPct, netUnitPricePkr: salesOrderLines.netUnitPricePkr,
      totalPkr: salesOrderLines.totalPkr, salesTaxPct: salesOrderLines.salesTaxPct,
      salesTaxPkr: salesOrderLines.salesTaxPkr, reservedQty: salesOrderLines.reservedQty,
      dispatchedQty: salesOrderLines.dispatchedQty, backorderQty: salesOrderLines.backorderQty,
      sortOrder: salesOrderLines.sortOrder, productId: salesOrderLines.productId,
      productName: products.name, productCode: products.code,
    })
    .from(salesOrderLines)
    .leftJoin(products, eq(products.id, salesOrderLines.productId))
    .where(eq(salesOrderLines.soId, id))
    .orderBy(salesOrderLines.sortOrder),

    tdb.select({
      id: stockReservations.id, soLineId: stockReservations.soLineId,
      lotBatchNo: stockReservations.lotBatchNo, expiryDate: stockReservations.expiryDate,
      reservedQty: stockReservations.reservedQty, status: stockReservations.status,
      productId: stockReservations.productId,
    })
    .from(stockReservations)
    .where(eq(stockReservations.soId, id)),
  ]);

  if (!so) notFound();

  const grandTotal = parseFloat(so.grandTotalPkr ?? '0');
  const whtAmt = parseFloat(so.whtPkr ?? '0');
  const netPayable = grandTotal - whtAmt;
  const totalReserved = lines.reduce((s, l) => s + parseFloat(l.reservedQty ?? '0'), 0);
  const totalOrdered = lines.reduce((s, l) => s + parseFloat(l.orderedQty ?? '0'), 0);
  const hasBackorder = lines.some((l) => parseFloat(l.backorderQty ?? '0') > 0);

  const resByLine = (lineId: string) => reservations.filter((r) => r.soLineId === lineId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/sales/orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{so.soNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[so.status ?? ''] ?? ''}`}>
              {STATUS_LABEL[so.status ?? ''] ?? so.status}
            </span>
            {so.creditCheck === 'override' && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                <Shield className="h-3 w-3" />Credit Override
              </span>
            )}
            {hasBackorder && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />Backorder
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{so.customerName} · {so.soDate}</p>
        </div>
        <div className="flex gap-2">
          {so.quotationId && (
            <Link href={`/sales/quotations/${so.quotationId}`}>
              <Button variant="outline" size="sm">View Quotation</Button>
            </Link>
          )}
          {(so.status === 'confirmed' || so.status === 'partially_dispatched') && (
            <Link href={`/sales/dispatch/new?soId=${id}`}>
              <Button className="bg-teal-600 hover:bg-teal-700" size="sm">Create Dispatch →</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Credit Check Banner */}
          {so.status === 'pending_approval' && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">Credit Hold — Finance Approval Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  Outstanding balance PKR {parseFloat(so.outstandingBalancePkr ?? '0').toLocaleString('en-PK')} +
                  SO value {pkr(so.grandTotalPkr)} exceeds credit limit {pkr(so.creditLimitPkr)}.
                </p>
              </div>
            </div>
          )}

          {so.creditCheck === 'fail' && so.status !== 'pending_approval' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <XCircle className="h-4 w-4" />Credit check failed — order was confirmed with override by Finance.
              {so.approvalNote && <span className="ml-1 text-xs">Note: {so.approvalNote}</span>}
            </div>
          )}

          {so.creditCheck === 'pass' && so.status !== 'draft' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />Credit check passed automatically.
            </div>
          )}

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Order Lines</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {['#', 'Product', 'Ordered', 'Unit Price', 'Disc', 'Total', 'Tax', 'Reserved', 'Dispatched', 'Backorder'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const lineRes = resByLine(l.id);
                      const resQty = parseFloat(l.reservedQty ?? '0');
                      const backQty = parseFloat(l.backorderQty ?? '0');
                      return (
                        <>
                          <tr key={l.id} className="border-b hover:bg-slate-50">
                            <td className="px-3 py-3 text-xs text-slate-400">{i + 1}</td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-slate-700">{l.productName ?? '—'}</p>
                              {l.productCode && <p className="text-xs text-slate-400">{l.productCode}</p>}
                            </td>
                            <td className="px-3 py-3 text-slate-600">{l.orderedQty} {l.uom}</td>
                            <td className="px-3 py-3 font-mono text-xs">{pkr(l.unitPricePkr)}</td>
                            <td className="px-3 py-3 text-xs text-slate-400">
                              {parseFloat(l.discountPct ?? '0') > 0 ? `${l.discountPct}%` : '—'}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs font-semibold">{pkr(l.totalPkr)}</td>
                            <td className="px-3 py-3 text-xs text-slate-400">{l.salesTaxPct}%</td>
                            <td className="px-3 py-3 text-xs">
                              {resQty > 0
                                ? <span className="text-teal-700 font-medium">{resQty} {l.uom}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-500">{parseFloat(l.dispatchedQty ?? '0')} {l.uom}</td>
                            <td className="px-3 py-3 text-xs">
                              {backQty > 0
                                ? <span className="text-orange-500 font-medium">{backQty} {l.uom}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                          {/* Lot reservation detail rows */}
                          {lineRes.length > 0 && lineRes.map((r) => (
                            <tr key={r.id} className="bg-teal-50/40 border-b">
                              <td />
                              <td colSpan={3} className="px-3 py-1.5 text-xs text-slate-400 pl-8">
                                Lot: <span className="font-mono text-slate-600">{r.lotBatchNo ?? 'No lot'}</span>
                                {r.expiryDate && <span className="ml-2 text-slate-400">Exp: {r.expiryDate}</span>}
                              </td>
                              <td colSpan={2} className="px-3 py-1.5 text-xs text-teal-600">
                                Reserved: {r.reservedQty} {l.uom}
                              </td>
                              <td colSpan={4} className="px-3 py-1.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.status === 'reserved' ? 'bg-teal-100 text-teal-700' : r.status === 'released' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-600'}`}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t">
                      <td colSpan={5} />
                      <td colSpan={5} className="px-3 py-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-slate-600"><span>Sub-total</span><span className="font-mono">{pkr(so.subtotalPkr)}</span></div>
                          <div className="flex justify-between text-slate-600"><span>Sales Tax</span><span className="font-mono">{pkr(so.salesTaxPkr)}</span></div>
                          <div className="flex justify-between font-semibold text-slate-800 border-t pt-1"><span>Grand Total</span><span className="font-mono">{pkr(so.grandTotalPkr)}</span></div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>WHT deductible ({so.whtRatePct}%)</span>
                            <span className="font-mono">-{pkr(so.whtPkr)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-teal-700 font-medium">
                            <span>Net payable</span>
                            <span className="font-mono">PKR {netPayable.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {so.internalNotes && (
            <Card className="border-dashed">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Internal Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600">{so.internalNotes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Order Summary</p>
              {[
                { label: 'SO No', value: so.soNo },
                { label: 'Customer', value: so.customerName ?? '—' },
                { label: 'Date', value: so.soDate },
                { label: 'Payment Terms', value: (so.paymentTerms ?? '').replace('_', ' ').replace('net', 'Net') },
                { label: 'Req. Delivery', value: so.requestedDeliveryDate ?? '—' },
                { label: 'Promised', value: so.promisedDeliveryDate ?? '—' },
                { label: 'Total Lines', value: String(lines.length) },
                { label: 'Total Reserved', value: `${totalReserved.toLocaleString('en-PK', { maximumFractionDigits: 0 })} units` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
              {so.cancellationReason && (
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-red-400">Cancellation: {so.cancellationReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <SoActions soId={id} status={so.status ?? 'draft'} creditCheck={so.creditCheck} />
        </div>
      </div>
    </div>
  );
}
