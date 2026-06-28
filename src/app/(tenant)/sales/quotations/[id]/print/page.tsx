import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesQuotations, salesQuotationLines, customers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { PrintButton } from '@/components/sales/print-button';

export const revalidate = 0;

const pkr = (v: string | number | null) => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '0');
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default async function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[qt], lines] = await Promise.all([
    tdb.select({
      id: salesQuotations.id, quotationNo: salesQuotations.quotationNo,
      revisionNo: salesQuotations.revisionNo,
      date: salesQuotations.date, validUntil: salesQuotations.validUntil,
      paymentTerms: salesQuotations.paymentTerms,
      termsConditions: salesQuotations.termsConditions,
      subtotalPkr: salesQuotations.subtotalPkr, salesTaxPkr: salesQuotations.salesTaxPkr,
      whtPkr: salesQuotations.whtPkr, grandTotalPkr: salesQuotations.grandTotalPkr,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerStrn: customers.strn,
      customerPhone: customers.phone, customerEmail: customers.email,
      customerBillingAddress: customers.billingAddress, whtRatePct: customers.whtRatePct,
    })
    .from(salesQuotations)
    .leftJoin(customers, eq(customers.id, salesQuotations.customerId))
    .where(eq(salesQuotations.id, id)).limit(1),

    tdb.select({
      id: salesQuotationLines.id, qty: salesQuotationLines.qty, uom: salesQuotationLines.uom,
      unitPricePkr: salesQuotationLines.unitPricePkr, discountPct: salesQuotationLines.discountPct,
      netUnitPricePkr: salesQuotationLines.netUnitPricePkr,
      totalPkr: salesQuotationLines.totalPkr, salesTaxPct: salesQuotationLines.salesTaxPct,
      salesTaxPkr: salesQuotationLines.salesTaxPkr, sortOrder: salesQuotationLines.sortOrder,
      productName: products.name, productCode: products.code,
    })
    .from(salesQuotationLines)
    .leftJoin(products, eq(products.id, salesQuotationLines.productId))
    .where(eq(salesQuotationLines.quotationId, id))
    .orderBy(salesQuotationLines.sortOrder),
  ]);

  if (!qt) notFound();
  const grandTotal = parseFloat(qt.grandTotalPkr ?? '0');
  const whtAmt = parseFloat(qt.whtPkr ?? '0');
  const netPayable = grandTotal - whtAmt;

  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <PrintButton />

      <div className="max-w-4xl mx-auto print:max-w-none">
        {/* Letterhead */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-teal-600">
          <div>
            <h1 className="text-2xl font-bold text-teal-700">IMPORTERPRO</h1>
            <p className="text-sm text-slate-500">Your Company Name · City, Pakistan</p>
            <p className="text-sm text-slate-500">NTN: 0000000-0 · STRN: 00-00-0000-000-00</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-800">QUOTATION</p>
            <p className="font-mono text-teal-700 text-lg">{qt.quotationNo}{(qt.revisionNo ?? 0) > 0 ? ` (Rev ${qt.revisionNo})` : ''}</p>
            <div className="text-sm text-slate-500 space-y-0.5 mt-1">
              <p>Date: {qt.date}</p>
              <p>Valid Until: <span className="font-medium text-slate-700">{qt.validUntil}</span></p>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Bill To</p>
          <p className="text-lg font-bold text-slate-800">{qt.customerName}</p>
          {qt.customerBillingAddress && <p className="text-sm text-slate-600">{qt.customerBillingAddress}</p>}
          <div className="flex gap-4 text-xs text-slate-500 mt-1">
            {qt.customerNtn && <span>NTN: {qt.customerNtn}</span>}
            {qt.customerStrn && <span>STRN: {qt.customerStrn}</span>}
            {qt.customerPhone && <span>Tel: {qt.customerPhone}</span>}
            {qt.customerEmail && <span>Email: {qt.customerEmail}</span>}
          </div>
        </div>

        {/* Line items table */}
        <table className="w-full mb-6 text-sm">
          <thead>
            <tr className="bg-teal-600 text-white">
              {['#', 'Product', 'Qty & UOM', 'Unit Price', 'Disc %', 'Net Price', 'Amount', 'Tax (%)'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-700">{l.productName}</p>
                  {l.productCode && <p className="text-xs text-slate-400">{l.productCode}</p>}
                </td>
                <td className="px-3 py-2 text-slate-600">{l.qty} {l.uom}</td>
                <td className="px-3 py-2 font-mono text-xs">{pkr(l.unitPricePkr)}</td>
                <td className="px-3 py-2 text-xs text-center">{parseFloat(l.discountPct ?? '0') > 0 ? `${l.discountPct}%` : '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{pkr(l.netUnitPricePkr)}</td>
                <td className="px-3 py-2 font-mono text-xs font-semibold">{pkr(l.totalPkr)}</td>
                <td className="px-3 py-2 text-xs text-center">{l.salesTaxPct}%<br /><span className="text-slate-400">{pkr(l.salesTaxPkr)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72 border rounded-lg overflow-hidden">
            {[
              { label: 'Sub-total', value: pkr(qt.subtotalPkr), bold: false },
              { label: 'Sales Tax', value: pkr(qt.salesTaxPkr), bold: false },
              { label: 'Grand Total', value: pkr(qt.grandTotalPkr), bold: true },
              { label: `WHT deductible (${qt.whtRatePct}% Sec 153)`, value: `- ${pkr(whtAmt)}`, bold: false },
            ].map(({ label, value, bold }) => (
              <div key={label} className={`flex justify-between px-4 py-2 text-sm border-b ${bold ? 'bg-teal-600 text-white font-bold' : 'text-slate-700'}`}>
                <span>{label}</span><span className="font-mono">{value}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2.5 text-sm font-semibold text-teal-700 bg-teal-50">
              <span>Net Payable</span>
              <span className="font-mono">{pkr(netPayable)}</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        <div className="mb-6 text-sm">
          <span className="font-medium text-slate-700">Payment Terms: </span>
          <span className="text-slate-600">{(qt.paymentTerms ?? '').replace('_', ' ').replace('net', 'Net')}</span>
        </div>

        {/* T&C */}
        {qt.termsConditions && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Terms & Conditions</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{qt.termsConditions}</p>
          </div>
        )}

        {/* Signature block */}
        <div className="mt-16 grid grid-cols-2 gap-16 text-sm">
          <div>
            <div className="border-b border-slate-400 mb-2 pb-8"></div>
            <p className="text-slate-600">Authorized Signatory</p>
            <p className="text-xs text-slate-400">ImporterPro</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mb-2 pb-8"></div>
            <p className="text-slate-600">Customer Acceptance</p>
            <p className="text-xs text-slate-400">{qt.customerName}</p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-10 print:block hidden">
          This is a computer-generated quotation. {qt.quotationNo} · {qt.date}
        </p>
      </div>
    </div>
  );
}
