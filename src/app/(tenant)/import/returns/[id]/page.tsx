import { auth } from '@/lib/auth/config';
import { redirect, notFound } from 'next/navigation';
import { getTenantDb } from '@/db';
import {
  purchaseReturnAuthorizations, praLines, suppliers, purchaseOrders, grns, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { PurchaseReturnActions } from '@/components/import/purchase-return-actions';

export const revalidate = 0;

const REASON_LABELS: Record<string, string> = {
  quality_issue: 'Quality Issue',
  wrong_product: 'Wrong Product',
  damaged: 'Damaged Goods',
  short_supply: 'Short Supply',
  price_dispute: 'Price Dispute',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  approved: 'bg-blue-100 text-blue-700',
  goods_dispatched: 'bg-amber-100 text-amber-700',
  debit_issued: 'bg-teal-100 text-teal-700',
  closed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default async function PurchaseReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[pra], lines] = await Promise.all([
    tdb.select({
      id: purchaseReturnAuthorizations.id,
      praNo: purchaseReturnAuthorizations.praNo,
      praDate: purchaseReturnAuthorizations.praDate,
      supplierId: purchaseReturnAuthorizations.supplierId,
      poId: purchaseReturnAuthorizations.poId,
      grnId: purchaseReturnAuthorizations.grnId,
      returnReason: purchaseReturnAuthorizations.returnReason,
      description: purchaseReturnAuthorizations.description,
      expectedDispatchDate: purchaseReturnAuthorizations.expectedDispatchDate,
      returnMode: purchaseReturnAuthorizations.returnMode,
      status: purchaseReturnAuthorizations.status,
      approvedAt: purchaseReturnAuthorizations.approvedAt,
      dispatchedAt: purchaseReturnAuthorizations.dispatchedAt,
      vehicleNo: purchaseReturnAuthorizations.vehicleNo,
      transportCompany: purchaseReturnAuthorizations.transportCompany,
      cancelledReason: purchaseReturnAuthorizations.cancelledReason,
      debitNoteId: purchaseReturnAuthorizations.debitNoteId,
      notes: purchaseReturnAuthorizations.notes,
      createdAt: purchaseReturnAuthorizations.createdAt,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      poNo: purchaseOrders.poNo,
      grnNo: grns.grnNo,
    })
    .from(purchaseReturnAuthorizations)
    .leftJoin(suppliers, eq(suppliers.id, purchaseReturnAuthorizations.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, purchaseReturnAuthorizations.poId))
    .leftJoin(grns, eq(grns.id, purchaseReturnAuthorizations.grnId))
    .where(eq(purchaseReturnAuthorizations.id, id)),

    tdb.select({
      id: praLines.id,
      description: praLines.description,
      returnQty: praLines.returnQty,
      dispatchedQty: praLines.dispatchedQty,
      uom: praLines.uom,
      unitPrice: praLines.unitPrice,
      currency: praLines.currency,
      lotNo: praLines.lotNo,
      sortOrder: praLines.sortOrder,
      productName: products.name,
    })
    .from(praLines)
    .leftJoin(products, eq(products.id, praLines.productId))
    .where(eq(praLines.praId, id))
    .orderBy(praLines.sortOrder),
  ]);

  if (!pra) notFound();

  const totalValue = lines.reduce((s, l) =>
    s + parseFloat(l.returnQty ?? '0') * parseFloat(l.unitPrice ?? '0'), 0);

  const currency = lines[0]?.currency ?? 'USD';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{pra.praNo}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[pra.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
              {(pra.status ?? 'draft').replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Supplier: <strong className="text-slate-700">{pra.supplierName}</strong>
            {pra.poNo && <> · PO: <Link href={`/import/purchase-orders/${pra.poId}`} className="font-mono text-teal-600 hover:underline">{pra.poNo}</Link></>}
            {pra.grnNo && <> · GRN: <span className="font-mono text-slate-600">{pra.grnNo}</span></>}
          </p>
        </div>
        <PurchaseReturnActions pra={pra} />
      </div>

      {pra.status === 'cancelled' && pra.cancelledReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>Cancelled:</strong> {pra.cancelledReason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Return Details</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-slate-500">PRA Date</dt>
            <dd className="text-slate-900">{pra.praDate ? format(new Date(pra.praDate), 'dd MMM yyyy') : '—'}</dd>
            <dt className="text-slate-500">Reason</dt>
            <dd className="text-slate-900">{REASON_LABELS[pra.returnReason ?? ''] ?? pra.returnReason}</dd>
            <dt className="text-slate-500">Return Mode</dt>
            <dd className="text-slate-900 capitalize">{(pra.returnMode ?? '').replace('_', ' ')}</dd>
            <dt className="text-slate-500">Expected Dispatch</dt>
            <dd className="text-slate-900">{pra.expectedDispatchDate ? format(new Date(pra.expectedDispatchDate), 'dd MMM yyyy') : '—'}</dd>
            {pra.approvedAt && (
              <>
                <dt className="text-slate-500">Approved At</dt>
                <dd className="text-slate-900">{format(new Date(pra.approvedAt), 'dd MMM yyyy HH:mm')}</dd>
              </>
            )}
            {pra.dispatchedAt && (
              <>
                <dt className="text-slate-500">Dispatched At</dt>
                <dd className="text-slate-900">{format(new Date(pra.dispatchedAt), 'dd MMM yyyy HH:mm')}</dd>
              </>
            )}
            {pra.vehicleNo && (
              <>
                <dt className="text-slate-500">Vehicle</dt>
                <dd className="text-slate-900 font-mono">{pra.vehicleNo}</dd>
              </>
            )}
            {pra.transportCompany && (
              <>
                <dt className="text-slate-500">Transport Co.</dt>
                <dd className="text-slate-900">{pra.transportCompany}</dd>
              </>
            )}
          </dl>
          {pra.description && (
            <div className="border-t pt-3">
              <p className="text-xs text-slate-500 mb-1">Description</p>
              <p className="text-sm text-slate-700">{pra.description}</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-slate-900 text-white p-5 space-y-4">
          <h2 className="font-semibold text-slate-100">Return Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Supplier</dt>
              <dd className="font-medium">{pra.supplierName}</dd>
            </div>
            {pra.supplierCountry && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Country</dt>
                <dd>{pra.supplierCountry}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="text-slate-300 font-medium">Est. Return Value</dt>
              <dd className="font-mono font-bold text-amber-400">
                {currency} {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </dd>
            </div>
          </dl>
          {pra.debitNoteId && (
            <div className="border-t border-slate-700 pt-3">
              <p className="text-xs text-slate-400 mb-1">Debit Note Issued</p>
              <Link href={`/import/debit-notes/${pra.debitNoteId}`} className="text-teal-400 hover:text-teal-300 text-sm font-medium underline">
                View Debit Note →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Return Items ({lines.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              {['Product / Description', 'Lot No', 'Return Qty', 'Dispatched Qty', 'UOM', 'Unit Price', 'Total Value', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No items</td></tr>
            )}
            {lines.map(l => {
              const total = parseFloat(l.returnQty ?? '0') * parseFloat(l.unitPrice ?? '0');
              const dispatched = parseFloat(l.dispatchedQty ?? '0');
              const returned = parseFloat(l.returnQty ?? '0');
              const pending = returned - dispatched;
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{l.productName ?? l.description}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">{l.lotNo ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{parseFloat(l.returnQty ?? '0').toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {dispatched > 0 ? (
                      <span className="text-green-700 font-medium">{dispatched.toLocaleString()}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{l.uom}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{l.currency ?? 'USD'} {parseFloat(l.unitPrice ?? '0').toFixed(4)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{total > 0 ? `${l.currency ?? 'USD'} ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td className="px-4 py-3">
                    {dispatched === 0 ? <span className="text-xs text-slate-400">Pending</span>
                      : dispatched >= returned ? <span className="text-xs text-green-700 font-semibold">Dispatched</span>
                      : <span className="text-xs text-amber-700">Partial ({pending.toLocaleString()} left)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-start">
        <Link href="/import/returns" className="text-sm text-slate-500 hover:text-slate-700">← Back to Purchase Returns</Link>
      </div>
    </div>
  );
}
