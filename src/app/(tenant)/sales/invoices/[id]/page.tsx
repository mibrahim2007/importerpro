import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesInvoices, salesInvoiceLines, invoicePayments, customers, products, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Printer } from 'lucide-react';
import { InvoiceActions } from '@/components/sales/invoice-actions';
import { PrintButton } from '@/components/sales/print-button';
import { db } from '@/db';

export const revalidate = 0;

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500', posted: 'bg-blue-100 text-blue-700',
  sent: 'bg-indigo-100 text-indigo-700', partially_paid: 'bg-amber-100 text-amber-700',
  fully_paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-400',
};
const TYPE_LABEL: Record<string, string> = {
  tax_invoice: 'Tax Invoice', simplified_invoice: 'Simplified Invoice',
  credit_note: 'Credit Note', debit_note: 'Debit Note',
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  // Fetch tenant company info (NTN/STRN for FBR invoice)
  const [tenant] = await db.select({ companyName: tenants.companyName, ntn: tenants.ntn, strn: tenants.strn, businessAddress: tenants.businessAddress }).from(tenants).where(eq(tenants.slug, session.user.tenantSlug)).limit(1);

  const [[invoice], lines, payments] = await Promise.all([
    tdb.select({
      id: salesInvoices.id, invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate, invoiceType: salesInvoices.invoiceType,
      status: salesInvoices.status, dueDate: salesInvoices.dueDate,
      paymentTerms: salesInvoices.paymentTerms, dcId: salesInvoices.dcId, soId: salesInvoices.soId,
      subtotalPkr: salesInvoices.subtotalPkr, salesTaxPkr: salesInvoices.salesTaxPkr,
      whtPkr: salesInvoices.whtPkr, grandTotalPkr: salesInvoices.grandTotalPkr,
      amountReceivedPkr: salesInvoices.amountReceivedPkr, balancePkr: salesInvoices.balancePkr,
      fbrStatus: salesInvoices.fbrStatus, fbrInvoiceNo: salesInvoices.fbrInvoiceNo,
      fbrQrCode: salesInvoices.fbrQrCode, fbrErrorCode: salesInvoices.fbrErrorCode,
      cancellationReason: salesInvoices.cancellationReason,
      internalNotes: salesInvoices.internalNotes, termsConditions: salesInvoices.termsConditions,
      postedAt: salesInvoices.postedAt, sentAt: salesInvoices.sentAt,
      createdAt: salesInvoices.createdAt,
      customerName: customers.name, customerId: salesInvoices.customerId,
      customerNtn: customers.ntn, customerStrn: customers.strn,
      customerBillingAddress: customers.billingAddress, customerCity: customers.city,
      customerWhtPct: customers.whtRatePct, customerCode: customers.code,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(eq(salesInvoices.id, id)).limit(1),

    tdb.select({
      id: salesInvoiceLines.id, productId: salesInvoiceLines.productId,
      hsCode: salesInvoiceLines.hsCode, description: salesInvoiceLines.description,
      qty: salesInvoiceLines.qty, uom: salesInvoiceLines.uom,
      unitPricePkr: salesInvoiceLines.unitPricePkr, discountPkr: salesInvoiceLines.discountPkr,
      taxableValuePkr: salesInvoiceLines.taxableValuePkr,
      salesTaxPct: salesInvoiceLines.salesTaxPct, salesTaxPkr: salesInvoiceLines.salesTaxPkr,
      sortOrder: salesInvoiceLines.sortOrder,
      productCode: products.code,
    })
    .from(salesInvoiceLines)
    .leftJoin(products, eq(products.id, salesInvoiceLines.productId))
    .where(eq(salesInvoiceLines.invoiceId, id))
    .orderBy(salesInvoiceLines.sortOrder),

    tdb.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, id))
      .orderBy(invoicePayments.paymentDate),
  ]);

  if (!invoice) notFound();

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = ['posted', 'sent', 'partially_paid'].includes(invoice.status ?? '') && invoice.dueDate && invoice.dueDate < today;
  const displayStatus = isOverdue ? 'overdue' : (invoice.status ?? 'draft');

  const fmt = (v: string | null) => v ? parseFloat(v).toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '0.00';

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Link href="/sales/invoices"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{invoice.invoiceNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[displayStatus]}`}>
              {displayStatus.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            <span className="px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-100">
              {TYPE_LABEL[invoice.invoiceType ?? 'tax_invoice'] ?? invoice.invoiceType}
            </span>
            {invoice.fbrInvoiceNo && (
              <span className="px-2 py-0.5 rounded text-xs font-mono text-green-700 bg-green-50">FBR: {invoice.fbrInvoiceNo}</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{invoice.customerName} · {invoice.invoiceDate}</p>
        </div>
        <div className="flex gap-2">
          {invoice.dcId && <Link href={`/sales/dispatch/${invoice.dcId}`}><Button variant="outline" size="sm">View DC →</Button></Link>}
          {invoice.soId && <Link href={`/sales/orders/${invoice.soId}`}><Button variant="outline" size="sm">View SO →</Button></Link>}
          <Link href={`/sales/invoices/${id}/print`}><Button variant="outline" size="sm"><Printer className="h-3.5 w-3.5 mr-1.5" />Print</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Cancellation banner */}
          {invoice.status === 'cancelled' && invoice.cancellationReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <strong>Cancelled:</strong> {invoice.cancellationReason}
            </div>
          )}

          {/* FBR status banner */}
          {invoice.fbrErrorCode && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <strong>FBR Rejection:</strong> {invoice.fbrErrorCode}
            </div>
          )}

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Invoice Lines</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {['#', 'Description', 'HS Code', 'Qty', 'UOM', 'Unit Price', 'Discount', 'Taxable Value', 'ST %', 'Sales Tax'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-700">{l.description}</p>
                          {l.productCode && <p className="text-xs text-slate-400">{l.productCode}</p>}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-500">{l.hsCode ?? '—'}</td>
                        <td className="px-3 py-3 font-semibold">{l.qty}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">{l.uom ?? '—'}</td>
                        <td className="px-3 py-3 text-right text-xs">PKR {fmt(l.unitPricePkr)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-400">{parseFloat(l.discountPkr ?? '0') > 0 ? `PKR ${fmt(l.discountPkr)}` : '—'}</td>
                        <td className="px-3 py-3 text-right font-semibold">PKR {fmt(l.taxableValuePkr)}</td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500">{l.salesTaxPct}%</td>
                        <td className="px-3 py-3 text-right text-xs text-blue-700 font-semibold">PKR {fmt(l.salesTaxPkr)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t text-sm">
                      <td colSpan={7} className="px-3 py-2.5 text-right text-slate-500 text-xs">Taxable Sub-total</td>
                      <td className="px-3 py-2.5 text-right font-semibold">PKR {fmt(invoice.subtotalPkr)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400 text-xs">Total Tax →</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-blue-700">PKR {fmt(invoice.salesTaxPkr)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Payment history */}
          {payments.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Payments Received</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {['Date', 'Amount', 'Method', 'Reference', 'Notes'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="px-4 py-2.5 text-xs">{p.paymentDate}</td>
                        <td className="px-4 py-2.5 font-semibold text-green-700">PKR {fmt(p.amountPkr)}</td>
                        <td className="px-4 py-2.5 text-xs capitalize text-slate-500">{p.paymentMethod?.replace('_', ' ')}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{p.referenceNo ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{p.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {invoice.termsConditions && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Terms & Conditions</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600 whitespace-pre-line">{invoice.termsConditions}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Totals */}
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Invoice Summary</p>
              {[
                { label: 'Taxable Sub-total', value: `PKR ${fmt(invoice.subtotalPkr)}`, className: 'text-white' },
                { label: 'Sales Tax (17%)', value: `PKR ${fmt(invoice.salesTaxPkr)}`, className: 'text-blue-300' },
                { label: 'Grand Total', value: `PKR ${fmt(invoice.grandTotalPkr)}`, className: 'text-white font-bold text-base' },
                ...(parseFloat(String(invoice.whtPkr ?? '0')) > 0 ? [
                  { label: `WHT (Sec.153 @ ${invoice.customerWhtPct}%)`, value: `- PKR ${fmt(invoice.whtPkr)}`, className: 'text-amber-300' },
                  { label: 'Net Payable', value: `PKR ${(parseFloat(String(invoice.grandTotalPkr ?? '0')) - parseFloat(String(invoice.whtPkr ?? '0'))).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`, className: 'text-teal-300 font-semibold' },
                ] : []),
                { label: 'Amount Received', value: `PKR ${fmt(invoice.amountReceivedPkr)}`, className: 'text-green-300' },
                { label: 'Balance Due', value: `PKR ${fmt(invoice.balancePkr)}`, className: `${parseFloat(String(invoice.balancePkr ?? '0')) > 0 ? 'text-red-300 font-bold' : 'text-green-300'} text-base` },
              ].map(({ label, value, className }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className={className}>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Invoice info */}
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="text-xs text-slate-400 mb-2">Invoice Info</p>
              {[
                { label: 'Invoice No', value: invoice.invoiceNo },
                { label: 'Date', value: invoice.invoiceDate },
                { label: 'Due Date', value: invoice.dueDate ?? '—' },
                { label: 'Payment Terms', value: (invoice.paymentTerms ?? 'net_30').replace('_', ' ') },
                { label: 'FBR Status', value: invoice.fbrStatus ?? 'pending' },
                { label: 'FBR Invoice No', value: invoice.fbrInvoiceNo ?? 'Not assigned' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-400 text-xs">{label}</span>
                  <span className="font-medium text-slate-700 text-xs text-right">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Bill To */}
          <Card>
            <CardContent className="p-4 text-sm space-y-1">
              <p className="text-xs text-slate-400 mb-2">Bill To</p>
              <p className="font-semibold text-slate-800">{invoice.customerName}</p>
              {invoice.customerBillingAddress && <p className="text-xs text-slate-500">{invoice.customerBillingAddress}</p>}
              {invoice.customerNtn && <p className="text-xs text-slate-400">NTN: {invoice.customerNtn}</p>}
              {invoice.customerStrn && <p className="text-xs text-slate-400">STRN: {invoice.customerStrn}</p>}
            </CardContent>
          </Card>

          {/* Seller (company) */}
          {tenant && (
            <Card>
              <CardContent className="p-4 text-sm space-y-1">
                <p className="text-xs text-slate-400 mb-2">Seller</p>
                <p className="font-semibold text-slate-800">{tenant.companyName}</p>
                {tenant.businessAddress && <p className="text-xs text-slate-500">{tenant.businessAddress}</p>}
                {tenant.ntn && <p className="text-xs text-slate-400">NTN: {tenant.ntn}</p>}
                {tenant.strn && <p className="text-xs text-slate-400">STRN: {tenant.strn}</p>}
              </CardContent>
            </Card>
          )}

          <InvoiceActions invoiceId={id} status={invoice.status ?? 'draft'} />
        </div>
      </div>
    </div>
  );
}
