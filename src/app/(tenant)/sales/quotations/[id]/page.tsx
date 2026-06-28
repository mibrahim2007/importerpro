import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesQuotations, salesQuotationLines, customers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Printer } from 'lucide-react';
import { QuotationActions } from '@/components/sales/quotation-actions';

export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500', sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-600',
  revised: 'bg-amber-100 text-amber-700', expired: 'bg-orange-100 text-orange-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

const pkr = (v: string | null) =>
  v ? `PKR ${parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '—';

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[quotation], lines] = await Promise.all([
    tdb.select({
      id: salesQuotations.id, quotationNo: salesQuotations.quotationNo,
      revisionNo: salesQuotations.revisionNo, parentQuotationId: salesQuotations.parentQuotationId,
      date: salesQuotations.date, validUntil: salesQuotations.validUntil,
      status: salesQuotations.status, paymentTerms: salesQuotations.paymentTerms,
      termsConditions: salesQuotations.termsConditions, internalNotes: salesQuotations.internalNotes,
      subtotalPkr: salesQuotations.subtotalPkr, salesTaxPkr: salesQuotations.salesTaxPkr,
      whtPkr: salesQuotations.whtPkr, grandTotalPkr: salesQuotations.grandTotalPkr,
      rejectionReason: salesQuotations.rejectionReason,
      sentAt: salesQuotations.sentAt, acceptedAt: salesQuotations.acceptedAt,
      inquiryId: salesQuotations.inquiryId, createdAt: salesQuotations.createdAt,
      customerId: salesQuotations.customerId,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerStrn: customers.strn,
      customerPhone: customers.phone, customerEmail: customers.email,
      customerBillingAddress: customers.billingAddress, whtRatePct: customers.whtRatePct,
    })
    .from(salesQuotations)
    .leftJoin(customers, eq(customers.id, salesQuotations.customerId))
    .where(eq(salesQuotations.id, id)).limit(1),

    tdb.select({
      id: salesQuotationLines.id, productId: salesQuotationLines.productId,
      qty: salesQuotationLines.qty, uom: salesQuotationLines.uom,
      unitPricePkr: salesQuotationLines.unitPricePkr,
      discountPct: salesQuotationLines.discountPct,
      netUnitPricePkr: salesQuotationLines.netUnitPricePkr,
      totalPkr: salesQuotationLines.totalPkr,
      salesTaxPct: salesQuotationLines.salesTaxPct,
      salesTaxPkr: salesQuotationLines.salesTaxPkr,
      landedCostRefPkr: salesQuotationLines.landedCostRefPkr,
      marginPct: salesQuotationLines.marginPct, sortOrder: salesQuotationLines.sortOrder,
      productName: products.name, productCode: products.code,
    })
    .from(salesQuotationLines)
    .leftJoin(products, eq(products.id, salesQuotationLines.productId))
    .where(eq(salesQuotationLines.quotationId, id))
    .orderBy(salesQuotationLines.sortOrder),
  ]);

  if (!quotation) notFound();
  const today = new Date().toISOString().split('T')[0];
  const isExpired = quotation.status === 'sent' && quotation.validUntil < today;
  const displayStatus = isExpired ? 'expired' : (quotation.status ?? 'draft');
  const grandTotal = parseFloat(quotation.grandTotalPkr ?? '0');
  const whtPkr = parseFloat(quotation.whtPkr ?? '0');
  const netPayable = grandTotal - whtPkr;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/sales/quotations"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{quotation.quotationNo}</h1>
            {(quotation.revisionNo ?? 0) > 0 && (
              <span className="text-xs text-slate-400">Rev {quotation.revisionNo}</span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[displayStatus] ?? ''}`}>
              {displayStatus}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {quotation.customerName} · {quotation.date} · Valid until {quotation.validUntil}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/sales/quotations/${id}/print`} target="_blank">
            <Button variant="outline" size="sm"><Printer className="mr-1.5 h-4 w-4" />Print / PDF</Button>
          </Link>
          {quotation.inquiryId && (
            <Link href={`/sales/inquiries/${quotation.inquiryId}`}>
              <Button variant="outline" size="sm">View Inquiry</Button>
            </Link>
          )}
          {displayStatus === 'accepted' && (
            <Link href={`/sales/orders/new?quotationId=${id}&customerId=${quotation.customerId}`}>
              <Button className="bg-teal-600 hover:bg-teal-700" size="sm">Create Sales Order →</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Customer info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bill To</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">{quotation.customerName}</p>
              {quotation.customerBillingAddress && <p>{quotation.customerBillingAddress}</p>}
              <div className="flex gap-4 text-xs text-slate-400 pt-1">
                {quotation.customerNtn && <span>NTN: {quotation.customerNtn}</span>}
                {quotation.customerStrn && <span>STRN: {quotation.customerStrn}</span>}
                {quotation.customerPhone && <span>Ph: {quotation.customerPhone}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Line Items</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {['#', 'Product', 'Qty', 'Unit Price', 'Disc %', 'Net Price', 'Total', 'Tax', 'Margin'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const margin = l.marginPct ? parseFloat(l.marginPct) : null;
                      return (
                        <tr key={l.id} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-700">{l.productName ?? '—'}</p>
                            {l.productCode && <p className="text-xs text-slate-400">{l.productCode}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{l.qty} {l.uom}</td>
                          <td className="px-4 py-3 font-mono text-xs">{pkr(l.unitPricePkr)}</td>
                          <td className="px-4 py-3 text-xs">
                            {parseFloat(l.discountPct ?? '0') > 0
                              ? <span className={parseFloat(l.discountPct ?? '0') > 5 ? 'text-amber-600 font-medium' : 'text-slate-500'}>{l.discountPct}%</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{pkr(l.netUnitPricePkr)}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{pkr(l.totalPkr)}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{l.salesTaxPct}% / {pkr(l.salesTaxPkr)}</td>
                          <td className="px-4 py-3 text-xs">
                            {margin !== null
                              ? <span className={margin >= 15 ? 'text-green-600 font-medium' : margin >= 5 ? 'text-amber-600' : 'text-red-500'}>
                                  {margin.toFixed(1)}%
                                </span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t">
                      <td colSpan={6} />
                      <td colSpan={3} className="px-4 py-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-slate-600">
                            <span>Sub-total</span><span className="font-mono">{pkr(quotation.subtotalPkr)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Sales Tax</span><span className="font-mono">{pkr(quotation.salesTaxPkr)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-slate-800 border-t pt-1">
                            <span>Grand Total</span><span className="font-mono">{pkr(quotation.grandTotalPkr)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>WHT deductible ({quotation.whtRatePct}%)</span>
                            <span className="font-mono">-{pkr(quotation.whtPkr)}</span>
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

          {quotation.termsConditions && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Terms & Conditions</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600 whitespace-pre-wrap">{quotation.termsConditions}</p></CardContent>
            </Card>
          )}

          {quotation.internalNotes && (
            <Card className="border-dashed">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Internal Notes (not on PDF)</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-500">{quotation.internalNotes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Quotation Summary</p>
              {[
                { label: 'Grand Total', value: pkr(quotation.grandTotalPkr) },
                { label: 'Payment Terms', value: (quotation.paymentTerms ?? '').replace('_', ' ').replace('net', 'Net') },
                { label: 'Valid Until', value: quotation.validUntil },
                { label: 'Lines', value: String(lines.length) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
              {quotation.rejectionReason && (
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-red-400">Rejection: {quotation.rejectionReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <QuotationActions quotationId={id} status={displayStatus} />

          {quotation.parentQuotationId && (
            <p className="text-xs text-slate-400 text-center">
              Revision of <Link href={`/sales/quotations/${quotation.parentQuotationId}`} className="text-teal-600 hover:underline">original quotation</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
