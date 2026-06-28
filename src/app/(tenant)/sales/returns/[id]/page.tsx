import { auth } from '@/lib/auth/config';
import { redirect, notFound } from 'next/navigation';
import { getTenantDb } from '@/db';
import {
  returnAuthorizations, returnAuthorizationLines,
  returnGrns, returnGrnLines,
  customers, salesInvoices, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { ReturnActions } from '@/components/sales/return-actions';

export const revalidate = 0;

const REASON_LABELS: Record<string, string> = {
  quality_issue: 'Quality Issue',
  wrong_product: 'Wrong Product',
  excess_supply: 'Excess Supply',
  price_dispute: 'Price Dispute',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  approved: 'bg-blue-100 text-blue-700',
  goods_received: 'bg-amber-100 text-amber-700',
  credit_issued: 'bg-teal-100 text-teal-700',
  closed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[ra], lines, grns] = await Promise.all([
    tdb.select({
      id: returnAuthorizations.id,
      raNo: returnAuthorizations.raNo,
      raDate: returnAuthorizations.raDate,
      customerId: returnAuthorizations.customerId,
      invoiceId: returnAuthorizations.invoiceId,
      returnReason: returnAuthorizations.returnReason,
      description: returnAuthorizations.description,
      expectedReturnDate: returnAuthorizations.expectedReturnDate,
      returnMode: returnAuthorizations.returnMode,
      status: returnAuthorizations.status,
      approvedAt: returnAuthorizations.approvedAt,
      cancelledReason: returnAuthorizations.cancelledReason,
      creditNoteId: returnAuthorizations.creditNoteId,
      notes: returnAuthorizations.notes,
      createdAt: returnAuthorizations.createdAt,
      customerName: customers.name,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      invoiceGrandTotal: salesInvoices.grandTotalPkr,
    })
    .from(returnAuthorizations)
    .leftJoin(customers, eq(customers.id, returnAuthorizations.customerId))
    .leftJoin(salesInvoices, eq(salesInvoices.id, returnAuthorizations.invoiceId))
    .where(eq(returnAuthorizations.id, id)),

    tdb.select({
      id: returnAuthorizationLines.id,
      description: returnAuthorizationLines.description,
      returnQty: returnAuthorizationLines.returnQty,
      uom: returnAuthorizationLines.uom,
      unitPricePkr: returnAuthorizationLines.unitPricePkr,
      lotNo: returnAuthorizationLines.lotNo,
      sortOrder: returnAuthorizationLines.sortOrder,
      productName: products.name,
    })
    .from(returnAuthorizationLines)
    .leftJoin(products, eq(products.id, returnAuthorizationLines.productId))
    .where(eq(returnAuthorizationLines.raId, id))
    .orderBy(returnAuthorizationLines.sortOrder),

    tdb.select({
      id: returnGrns.id,
      returnGrnNo: returnGrns.returnGrnNo,
      receivedDate: returnGrns.receivedDate,
      status: returnGrns.status,
      inspectorNotes: returnGrns.inspectorNotes,
      createdAt: returnGrns.createdAt,
    })
    .from(returnGrns)
    .where(eq(returnGrns.raId, id)),
  ]);

  if (!ra) notFound();

  const totalReturnValue = lines.reduce((s, l) =>
    s + parseFloat(l.returnQty ?? '0') * parseFloat(l.unitPricePkr ?? '0'), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{ra.raNo}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[ra.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
              {(ra.status ?? 'draft').replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Customer: <strong className="text-slate-700">{ra.customerName}</strong>
            {' · '}Invoice:{' '}
            <Link href={`/sales/invoices/${ra.invoiceId}`} className="font-mono text-teal-600 hover:underline">
              {ra.invoiceNo}
            </Link>
          </p>
        </div>
        <ReturnActions ra={ra} />
      </div>

      {/* Cancelled banner */}
      {ra.status === 'cancelled' && ra.cancelledReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>Cancelled:</strong> {ra.cancelledReason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Return Details</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-slate-500">RA Date</dt>
            <dd className="text-slate-900">{ra.raDate ? format(new Date(ra.raDate), 'dd MMM yyyy') : '—'}</dd>
            <dt className="text-slate-500">Reason</dt>
            <dd className="text-slate-900">{REASON_LABELS[ra.returnReason ?? ''] ?? ra.returnReason}</dd>
            <dt className="text-slate-500">Return Mode</dt>
            <dd className="text-slate-900 capitalize">{(ra.returnMode ?? '').replace('_', ' ')}</dd>
            <dt className="text-slate-500">Expected Return</dt>
            <dd className="text-slate-900">{ra.expectedReturnDate ? format(new Date(ra.expectedReturnDate), 'dd MMM yyyy') : '—'}</dd>
            {ra.approvedAt && (
              <>
                <dt className="text-slate-500">Approved At</dt>
                <dd className="text-slate-900">{format(new Date(ra.approvedAt), 'dd MMM yyyy HH:mm')}</dd>
              </>
            )}
          </dl>
          {ra.description && (
            <div className="border-t pt-3">
              <p className="text-xs text-slate-500 mb-1">Description</p>
              <p className="text-sm text-slate-700">{ra.description}</p>
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="rounded-xl bg-slate-900 text-white p-5 space-y-4">
          <h2 className="font-semibold text-slate-100">Return Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Original Invoice</dt>
              <dd className="font-mono font-semibold">{ra.invoiceNo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Invoice Value</dt>
              <dd className="font-mono">PKR {parseFloat(ra.invoiceGrandTotal ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="text-slate-300 font-medium">Est. Return Value</dt>
              <dd className="font-mono font-bold text-amber-400">
                PKR {totalReturnValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </dd>
            </div>
          </dl>
          {ra.creditNoteId && (
            <div className="border-t border-slate-700 pt-3">
              <p className="text-xs text-slate-400 mb-1">Credit Note Issued</p>
              <Link href={`/sales/credit-notes/${ra.creditNoteId}`} className="text-teal-400 hover:text-teal-300 text-sm font-medium underline">
                View Credit Note →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Return Items ({lines.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              {['Product / Description', 'Lot No', 'Return Qty', 'UOM', 'Unit Price (PKR)', 'Total (PKR)'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No items</td></tr>
            )}
            {lines.map((l, i) => {
              const total = parseFloat(l.returnQty ?? '0') * parseFloat(l.unitPricePkr ?? '0');
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{l.productName ?? l.description}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">{l.lotNo ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{parseFloat(l.returnQty ?? '0').toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500">{l.uom}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{parseFloat(l.unitPricePkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Return GRNs */}
      {grns.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800 text-sm">Return GRNs</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                {['GRN No', 'Received Date', 'Status', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grns.map(g => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-teal-700">{g.returnGrnNo}</td>
                  <td className="px-4 py-3">{g.receivedDate ? format(new Date(g.receivedDate), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${g.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{g.inspectorNotes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-start">
        <Link href="/sales/returns" className="text-sm text-slate-500 hover:text-slate-700">← Back to Returns</Link>
      </div>
    </div>
  );
}
