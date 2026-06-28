import { auth } from '@/lib/auth/config';
import { redirect, notFound } from 'next/navigation';
import { getTenantDb } from '@/db';
import {
  salesInvoices, salesInvoiceLines, returnAuthorizations, customers, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { CreditNoteActions } from '@/components/sales/credit-note-actions';

export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  posted: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[cn], lines] = await Promise.all([
    tdb.select({
      id: salesInvoices.id,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      customerId: salesInvoices.customerId,
      raId: salesInvoices.raId,
      linkedInvoiceId: salesInvoices.linkedInvoiceId,
      creditApplicationType: salesInvoices.creditApplicationType,
      status: salesInvoices.status,
      subtotalPkr: salesInvoices.subtotalPkr,
      salesTaxPkr: salesInvoices.salesTaxPkr,
      grandTotalPkr: salesInvoices.grandTotalPkr,
      internalNotes: salesInvoices.internalNotes,
      createdAt: salesInvoices.createdAt,
      postedAt: salesInvoices.postedAt,
      customerName: customers.name,
      customerNtn: customers.ntn,
      customerStrn: customers.strn,
      customerAddress: customers.billingAddress,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(eq(salesInvoices.id, id)),

    tdb.select({
      id: salesInvoiceLines.id,
      description: salesInvoiceLines.description,
      qty: salesInvoiceLines.qty,
      uom: salesInvoiceLines.uom,
      unitPricePkr: salesInvoiceLines.unitPricePkr,
      taxableValuePkr: salesInvoiceLines.taxableValuePkr,
      salesTaxPct: salesInvoiceLines.salesTaxPct,
      salesTaxPkr: salesInvoiceLines.salesTaxPkr,
      sortOrder: salesInvoiceLines.sortOrder,
      productName: products.name,
    })
    .from(salesInvoiceLines)
    .leftJoin(products, eq(products.id, salesInvoiceLines.productId))
    .where(eq(salesInvoiceLines.invoiceId, id))
    .orderBy(salesInvoiceLines.sortOrder),
  ]);

  if (!cn) notFound();

  // Linked objects
  let linkedInvoice: any = null;
  let linkedRa: any = null;

  if (cn.linkedInvoiceId) {
    const [inv] = await tdb.select({ invoiceNo: salesInvoices.invoiceNo }).from(salesInvoices).where(eq(salesInvoices.id, cn.linkedInvoiceId));
    linkedInvoice = inv ?? null;
  }
  if (cn.raId) {
    const [ra] = await tdb.select({ raNo: returnAuthorizations.raNo }).from(returnAuthorizations).where(eq(returnAuthorizations.id, cn.raId));
    linkedRa = ra ?? null;
  }

  const subtotal = parseFloat(cn.subtotalPkr ?? '0');
  const salesTax = parseFloat(cn.salesTaxPkr ?? '0');
  const grandTotal = parseFloat(cn.grandTotalPkr ?? '0');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{cn.invoiceNo}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[cn.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
              {cn.status ?? 'draft'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Customer: <strong className="text-slate-700">{cn.customerName}</strong>
            {linkedInvoice && (
              <> · Reverses: <Link href={`/sales/invoices/${cn.linkedInvoiceId}`} className="font-mono text-teal-600 hover:underline">{linkedInvoice.invoiceNo}</Link></>
            )}
            {linkedRa && (
              <> · RA: <Link href={`/sales/returns/${cn.raId}`} className="font-mono text-teal-600 hover:underline">{linkedRa.raNo}</Link></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/sales/invoices/${id}/print`} target="_blank"
            className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Print / PDF
          </Link>
          <CreditNoteActions cn={cn} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Meta */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Details</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-slate-500">CN Date</dt>
            <dd>{cn.invoiceDate ? format(new Date(cn.invoiceDate), 'dd MMM yyyy') : '—'}</dd>
            <dt className="text-slate-500">Customer NTN</dt>
            <dd className="font-mono">{cn.customerNtn ?? '—'}</dd>
            <dt className="text-slate-500">Customer STRN</dt>
            <dd className="font-mono">{cn.customerStrn ?? '—'}</dd>
            <dt className="text-slate-500">Application</dt>
            <dd className="capitalize">{(cn.creditApplicationType ?? '').replace('_', ' ') || '—'}</dd>
            {cn.postedAt && (
              <>
                <dt className="text-slate-500">Posted At</dt>
                <dd>{format(new Date(cn.postedAt), 'dd MMM yyyy HH:mm')}</dd>
              </>
            )}
          </dl>
          {cn.internalNotes && (
            <div className="border-t pt-3">
              <p className="text-xs text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700">{cn.internalNotes}</p>
            </div>
          )}
        </div>

        {/* Financials */}
        <div className="rounded-xl bg-slate-900 text-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-100">Credit Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Subtotal</dt>
              <dd className="font-mono">PKR {subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Sales Tax (Reversal)</dt>
              <dd className="font-mono text-blue-300">PKR {salesTax.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="text-slate-100 font-semibold">Total Credit</dt>
              <dd className="font-mono font-bold text-teal-400 text-lg">
                PKR {grandTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </dd>
            </div>
          </dl>
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs text-slate-500">
              {cn.creditApplicationType === 'applied_to_invoice'
                ? 'This credit is applied against the linked invoice balance.'
                : 'This credit is processed as a customer refund.'}
            </p>
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Credit Note Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              {['Product / Description', 'Qty', 'UOM', 'Unit Price (PKR)', 'Taxable Value', 'ST%', 'Sales Tax (PKR)', 'Line Total (PKR)'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No lines</td></tr>
            )}
            {lines.map(l => {
              const lineTotal = parseFloat(l.taxableValuePkr ?? '0') + parseFloat(l.salesTaxPkr ?? '0');
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{l.productName ?? l.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{parseFloat(l.qty ?? '0').toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500">{l.uom}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{parseFloat(l.unitPricePkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{parseFloat(l.taxableValuePkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center text-blue-700">{l.salesTaxPct}%</td>
                  <td className="px-4 py-3 text-right tabular-nums text-blue-700">{parseFloat(l.salesTaxPkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={3} />
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Totals</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold">{subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
              <td />
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-700">{salesTax.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{grandTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-start">
        <Link href="/sales/credit-notes" className="text-sm text-slate-500 hover:text-slate-700">← Back to Credit Notes</Link>
      </div>
    </div>
  );
}
