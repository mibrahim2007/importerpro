import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesInvoices, salesInvoiceLines, customers, products, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { PrintButton } from '@/components/sales/print-button';

export const revalidate = 0;

const TYPE_LABEL: Record<string, string> = {
  tax_invoice: 'SALES TAX INVOICE', simplified_invoice: 'SIMPLIFIED TAX INVOICE',
  credit_note: 'CREDIT NOTE', debit_note: 'DEBIT NOTE',
};

function fmt(v: string | null | undefined) {
  return v ? parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
}

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [tenant] = await db.select({ companyName: tenants.companyName, ntn: tenants.ntn, strn: tenants.strn, businessAddress: tenants.businessAddress }).from(tenants).where(eq(tenants.slug, session.user.tenantSlug)).limit(1);

  const [[invoice], lines] = await Promise.all([
    tdb.select({
      id: salesInvoices.id, invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate, invoiceType: salesInvoices.invoiceType,
      dueDate: salesInvoices.dueDate, paymentTerms: salesInvoices.paymentTerms,
      subtotalPkr: salesInvoices.subtotalPkr, salesTaxPkr: salesInvoices.salesTaxPkr,
      whtPkr: salesInvoices.whtPkr, grandTotalPkr: salesInvoices.grandTotalPkr,
      fbrInvoiceNo: salesInvoices.fbrInvoiceNo, termsConditions: salesInvoices.termsConditions,
      dcId: salesInvoices.dcId, soId: salesInvoices.soId,
      customerName: customers.name, customerNtn: customers.ntn, customerStrn: customers.strn,
      customerBillingAddress: customers.billingAddress, customerCity: customers.city,
      customerWhtPct: customers.whtRatePct,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(eq(salesInvoices.id, id)).limit(1),

    tdb.select({
      id: salesInvoiceLines.id, hsCode: salesInvoiceLines.hsCode,
      description: salesInvoiceLines.description, qty: salesInvoiceLines.qty,
      uom: salesInvoiceLines.uom, unitPricePkr: salesInvoiceLines.unitPricePkr,
      discountPkr: salesInvoiceLines.discountPkr, taxableValuePkr: salesInvoiceLines.taxableValuePkr,
      salesTaxPct: salesInvoiceLines.salesTaxPct, salesTaxPkr: salesInvoiceLines.salesTaxPkr,
      sortOrder: salesInvoiceLines.sortOrder, productCode: products.code,
    })
    .from(salesInvoiceLines)
    .leftJoin(products, eq(products.id, salesInvoiceLines.productId))
    .where(eq(salesInvoiceLines.invoiceId, id))
    .orderBy(salesInvoiceLines.sortOrder),
  ]);

  if (!invoice) notFound();

  const whtAmt = parseFloat(String(invoice.whtPkr ?? '0'));
  const grandTotal = parseFloat(String(invoice.grandTotalPkr ?? '0'));
  const netPayable = grandTotal - whtAmt;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden p-4 flex justify-end gap-2">
        <PrintButton />
      </div>

      {/* A4 invoice */}
      <div className="max-w-3xl mx-auto bg-white shadow print:shadow-none p-10 print:p-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-teal-600 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-teal-700">{tenant?.companyName ?? 'Company Name'}</h1>
            {tenant?.businessAddress && <p className="text-xs text-slate-500 mt-0.5 max-w-xs">{tenant.businessAddress}</p>}
            <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
              {tenant?.ntn && <span>NTN: <strong>{tenant.ntn}</strong></span>}
              {tenant?.strn && <span>STRN: <strong>{tenant.strn}</strong></span>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-slate-700">{TYPE_LABEL[invoice.invoiceType ?? 'tax_invoice'] ?? 'TAX INVOICE'}</h2>
            <p className="text-2xl font-black text-teal-700 mt-1">{invoice.invoiceNo}</p>
            {invoice.fbrInvoiceNo && (
              <div className="mt-2 border border-green-300 rounded p-2 text-xs text-green-700 bg-green-50">
                <p className="font-semibold">FBR Invoice No</p>
                <p className="font-mono">{invoice.fbrInvoiceNo}</p>
              </div>
            )}
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bill To</p>
            <p className="font-bold text-slate-800">{invoice.customerName}</p>
            {invoice.customerBillingAddress && <p className="text-xs text-slate-500 mt-0.5">{invoice.customerBillingAddress}</p>}
            {invoice.customerCity && <p className="text-xs text-slate-500">{invoice.customerCity}</p>}
            <div className="flex gap-3 mt-1 text-xs text-slate-400">
              {invoice.customerNtn && <span>NTN: <strong>{invoice.customerNtn}</strong></span>}
              {invoice.customerStrn && <span>STRN: <strong>{invoice.customerStrn}</strong></span>}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="space-y-1">
              {[
                { label: 'Invoice Date', value: invoice.invoiceDate },
                { label: 'Due Date', value: invoice.dueDate ?? '—' },
                { label: 'Payment Terms', value: (invoice.paymentTerms ?? '').replace('_', ' ') },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full text-sm mb-6 border-collapse">
          <thead>
            <tr className="bg-teal-600 text-white">
              {['#', 'Description', 'HS Code', 'Qty', 'UOM', 'Unit Price', 'Discount', 'Taxable Value', 'ST%', 'Sales Tax'].map((h) => (
                <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-2 py-2 text-xs text-slate-400 border-b border-slate-100">{i + 1}</td>
                <td className="px-2 py-2 text-xs font-medium text-slate-800 border-b border-slate-100">
                  {l.description}{l.productCode ? ` (${l.productCode})` : ''}
                </td>
                <td className="px-2 py-2 text-xs font-mono text-slate-500 border-b border-slate-100">{l.hsCode ?? '—'}</td>
                <td className="px-2 py-2 text-xs text-right border-b border-slate-100">{l.qty}</td>
                <td className="px-2 py-2 text-xs text-slate-500 border-b border-slate-100">{l.uom ?? '—'}</td>
                <td className="px-2 py-2 text-xs text-right border-b border-slate-100">{fmt(l.unitPricePkr)}</td>
                <td className="px-2 py-2 text-xs text-right text-slate-400 border-b border-slate-100">{parseFloat(l.discountPkr ?? '0') > 0 ? fmt(l.discountPkr) : '—'}</td>
                <td className="px-2 py-2 text-xs text-right font-semibold border-b border-slate-100">{fmt(l.taxableValuePkr)}</td>
                <td className="px-2 py-2 text-xs text-right text-slate-500 border-b border-slate-100">{l.salesTaxPct}%</td>
                <td className="px-2 py-2 text-xs text-right font-semibold text-blue-700 border-b border-slate-100">{fmt(l.salesTaxPkr)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72 border border-slate-200 rounded overflow-hidden">
            {[
              { label: 'Taxable Sub-total (PKR)', value: fmt(invoice.subtotalPkr), className: 'text-slate-700' },
              { label: 'Sales Tax (PKR)', value: fmt(invoice.salesTaxPkr), className: 'text-blue-700' },
              { label: 'Grand Total (PKR)', value: fmt(invoice.grandTotalPkr), className: 'font-bold text-slate-900', bg: 'bg-slate-100' },
              ...(whtAmt > 0 ? [
                { label: `WHT Section 153 @ ${invoice.customerWhtPct}% (PKR)`, value: `(${fmt(invoice.whtPkr)})`, className: 'text-amber-700' },
                { label: 'Net Payable (PKR)', value: netPayable.toLocaleString('en-PK', { minimumFractionDigits: 2 }), className: 'font-bold text-teal-700 text-base', bg: 'bg-teal-50' },
              ] : []),
            ].map(({ label, value, className, bg }) => (
              <div key={label} className={`flex justify-between px-3 py-2 text-xs border-b border-slate-100 last:border-0 ${bg ?? ''}`}>
                <span className="text-slate-500">{label}</span>
                <span className={className}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* T&C + Signature */}
        {invoice.termsConditions && (
          <div className="border-t pt-4 mb-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Terms & Conditions</p>
            <p className="text-xs text-slate-500 whitespace-pre-line">{invoice.termsConditions}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-10 mt-10 border-t pt-6">
          <div className="text-center">
            <div className="border-t border-slate-300 mt-16 pt-1"></div>
            <p className="text-xs text-slate-500">Authorised Signatory (Seller)</p>
            <p className="text-[10px] text-slate-400">{tenant?.companyName}</p>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-300 mt-16 pt-1"></div>
            <p className="text-xs text-slate-500">Received By (Customer)</p>
            <p className="text-[10px] text-slate-400">{invoice.customerName}</p>
          </div>
        </div>

        {/* FBR footer note */}
        <div className="mt-6 text-center text-[9px] text-slate-400 border-t pt-3">
          <p>This is a computer-generated invoice. Verify at FBR portal: iris.fbr.gov.pk</p>
          {invoice.fbrInvoiceNo && <p className="font-mono">FBR Invoice No: {invoice.fbrInvoiceNo}</p>}
        </div>
      </div>
    </div>
  );
}
