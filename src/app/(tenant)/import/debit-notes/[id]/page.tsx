import { auth } from '@/lib/auth/config';
import { redirect, notFound } from 'next/navigation';
import { getTenantDb } from '@/db';
import {
  vendorBills, vendorBillLines, purchaseReturnAuthorizations, suppliers,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { PurchaseDebitNoteActions } from '@/components/import/purchase-debit-note-actions';

export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  posted: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default async function DebitNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[dn], lines] = await Promise.all([
    tdb.select({
      id: vendorBills.id,
      billNo: vendorBills.billNo,
      billDate: vendorBills.billDate,
      dueDate: vendorBills.dueDate,
      supplierId: vendorBills.supplierId,
      praId: vendorBills.praId,
      linkedBillId: vendorBills.linkedBillId,
      debitApplicationType: vendorBills.debitApplicationType,
      status: vendorBills.status,
      currency: vendorBills.currency,
      exchangeRate: vendorBills.exchangeRate,
      subtotal: vendorBills.subtotal,
      taxAmount: vendorBills.taxAmount,
      totalAmount: vendorBills.totalAmount,
      totalAmountPkr: vendorBills.totalAmountPkr,
      totalPaid: vendorBills.totalPaid,
      balanceDue: vendorBills.balanceDue,
      notes: vendorBills.notes,
      supplierInvoiceNo: vendorBills.supplierInvoiceNo,
      postedAt: vendorBills.postedAt,
      createdAt: vendorBills.createdAt,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
    })
    .from(vendorBills)
    .leftJoin(suppliers, eq(suppliers.id, vendorBills.supplierId))
    .where(eq(vendorBills.id, id)),

    tdb.select().from(vendorBillLines).where(eq(vendorBillLines.billId, id)).orderBy(vendorBillLines.sortOrder),
  ]);

  if (!dn) notFound();

  // Linked objects
  let linkedBill: any = null;
  let linkedPra: any = null;

  if (dn.linkedBillId) {
    const [lb] = await tdb.select({ billNo: vendorBills.billNo, totalAmountPkr: vendorBills.totalAmountPkr, balanceDue: vendorBills.balanceDue })
      .from(vendorBills).where(eq(vendorBills.id, dn.linkedBillId));
    linkedBill = lb ?? null;
  }
  if (dn.praId) {
    const [pra] = await tdb.select({ praNo: purchaseReturnAuthorizations.praNo })
      .from(purchaseReturnAuthorizations).where(eq(purchaseReturnAuthorizations.id, dn.praId));
    linkedPra = pra ?? null;
  }

  const subtotal = parseFloat(dn.subtotal ?? '0');
  const taxAmt = parseFloat(dn.taxAmount ?? '0');
  const totalFx = parseFloat(dn.totalAmount ?? '0');
  const totalPkr = parseFloat(dn.totalAmountPkr ?? '0');
  const rate = parseFloat(dn.exchangeRate ?? '1');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{dn.billNo}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[dn.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
              {dn.status ?? 'draft'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Supplier: <strong className="text-slate-700">{dn.supplierName}</strong>
            {linkedBill && (
              <> · Reverses: <Link href={`/finance/bills/${dn.linkedBillId}`} className="font-mono text-teal-600 hover:underline">{linkedBill.billNo}</Link></>
            )}
            {linkedPra && (
              <> · PRA: <Link href={`/import/returns/${dn.praId}`} className="font-mono text-teal-600 hover:underline">{linkedPra.praNo}</Link></>
            )}
          </p>
        </div>
        <PurchaseDebitNoteActions dn={dn} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Details</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-slate-500">DN Date</dt>
            <dd>{dn.billDate ? format(new Date(dn.billDate), 'dd MMM yyyy') : '—'}</dd>
            <dt className="text-slate-500">Currency</dt>
            <dd className="font-mono">{dn.currency} @ {rate.toFixed(4)}</dd>
            <dt className="text-slate-500">Supplier Country</dt>
            <dd>{dn.supplierCountry ?? '—'}</dd>
            <dt className="text-slate-500">Application</dt>
            <dd className="capitalize">{(dn.debitApplicationType ?? '').replace('_', ' ') || '—'}</dd>
            {dn.supplierInvoiceNo && (
              <>
                <dt className="text-slate-500">Supplier Ref.</dt>
                <dd className="font-mono text-xs">{dn.supplierInvoiceNo}</dd>
              </>
            )}
            {dn.postedAt && (
              <>
                <dt className="text-slate-500">Posted At</dt>
                <dd>{format(new Date(dn.postedAt), 'dd MMM yyyy HH:mm')}</dd>
              </>
            )}
          </dl>
          {linkedBill && (
            <div className="border-t pt-3 text-sm">
              <p className="text-xs text-slate-500 mb-1">Original Bill Balance After Debit</p>
              <p className="font-mono font-semibold text-slate-800">
                PKR {parseFloat(linkedBill.balanceDue ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })} remaining
              </p>
            </div>
          )}
          {dn.notes && (
            <div className="border-t pt-3">
              <p className="text-xs text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700">{dn.notes}</p>
            </div>
          )}
        </div>

        {/* Financials */}
        <div className="rounded-xl bg-slate-900 text-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-100">Debit Note Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Subtotal ({dn.currency})</dt>
              <dd className="font-mono">{dn.currency} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
            </div>
            {taxAmt > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Tax</dt>
                <dd className="font-mono">{dn.currency} {taxAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="text-slate-300">Total ({dn.currency})</dt>
              <dd className="font-mono">{dn.currency} {totalFx.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="text-slate-100 font-semibold">Total (PKR)</dt>
              <dd className="font-mono font-bold text-amber-400 text-lg">
                PKR {totalPkr.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </dd>
            </div>
          </dl>
          <div className="border-t border-slate-700 pt-3 text-xs text-slate-500">
            {dn.debitApplicationType === 'applied_to_bill'
              ? 'This debit reduces the linked vendor bill outstanding balance.'
              : 'This debit is recorded as a supplier credit note received.'}
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Debit Note Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              {['Description', 'Qty', 'Unit Price', 'Amount', 'Tax%', 'Tax Amount', 'Total'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No lines</td></tr>
            )}
            {lines.map(l => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-900">{l.description}</td>
                <td className="px-4 py-3 text-right tabular-nums">{parseFloat(l.quantity ?? '1').toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{parseFloat(l.unitPrice ?? '0').toFixed(4)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{parseFloat(l.amount ?? '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-center">{l.taxPct}%</td>
                <td className="px-4 py-3 text-right tabular-nums text-blue-700">{parseFloat(l.taxAmount ?? '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{parseFloat(l.totalAmount ?? '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={3} />
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Totals</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold">{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td />
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-700">{taxAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold">{totalFx.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-start">
        <Link href="/import/debit-notes" className="text-sm text-slate-500 hover:text-slate-700">← Back to Debit Notes</Link>
      </div>
    </div>
  );
}
