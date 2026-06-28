import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customerReceipts, receiptAllocations, salesInvoices, customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { PaymentActions } from '@/components/sales/payment-actions';

export const revalidate = 0;

const STATUS_COLOR: Record<string, string> = {
  cleared: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700',
  bounced: 'bg-red-100 text-red-600', cancelled: 'bg-slate-100 text-slate-400',
};
const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank Transfer / TT',
  online: 'Online Payment', pdc: 'PDC (Post-Dated Cheque)',
};

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[receipt], allocs] = await Promise.all([
    tdb.select({
      ...customerReceipts,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerBillingAddress: customers.billingAddress,
    })
    .from(customerReceipts)
    .leftJoin(customers, eq(customers.id, customerReceipts.customerId))
    .where(eq(customerReceipts.id, id)).limit(1),

    tdb.select({
      id: receiptAllocations.id,
      invoiceId: receiptAllocations.invoiceId,
      allocatedAmountPkr: receiptAllocations.allocatedAmountPkr,
      allocatedAt: receiptAllocations.allocatedAt,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      grandTotalPkr: salesInvoices.grandTotalPkr,
      balancePkr: salesInvoices.balancePkr,
      status: salesInvoices.status,
    })
    .from(receiptAllocations)
    .leftJoin(salesInvoices, eq(salesInvoices.id, receiptAllocations.invoiceId))
    .where(eq(receiptAllocations.receiptId, id)),
  ]);

  if (!receipt) notFound();

  const fmt = (v: string | null | undefined) =>
    v ? parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Link href="/sales/payments"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{receipt.receiptNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLOR[receipt.status ?? ''] ?? ''}`}>
              {receipt.status}
            </span>
            {receipt.paymentMethod === 'pdc' && (
              <span className="px-2 py-0.5 rounded text-xs text-amber-600 bg-amber-50 font-medium">PDC</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{receipt.customerName} · {receipt.receiptDate}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {receipt.bouncedReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <strong>Bounced:</strong> {receipt.bouncedReason}
            </div>
          )}

          {receipt.status === 'pending' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              PDC cheque is pending. Invoice balances will update when you clear this receipt.
              {receipt.chequeDueDate && <span className="ml-2">Due: <strong>{receipt.chequeDueDate}</strong></span>}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Invoice Allocations</CardTitle></CardHeader>
            {allocs.length === 0 ? (
              <CardContent>
                <p className="text-sm text-slate-400">No invoice allocations — advance payment / unallocated credit</p>
              </CardContent>
            ) : (
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {['Invoice No', 'Invoice Date', 'Invoice Total', 'Current Balance', 'Allocated', 'Invoice Status'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allocs.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link href={`/sales/invoices/${a.invoiceId}`} className="font-mono text-xs font-semibold text-teal-700 hover:underline">{a.invoiceNo}</Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{a.invoiceDate}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">PKR {fmt(a.grandTotalPkr)}</td>
                        <td className="px-4 py-3 text-xs font-medium text-red-600">PKR {fmt(a.balancePkr)}</td>
                        <td className="px-4 py-3 font-semibold text-green-700">PKR {fmt(a.allocatedAmountPkr)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs capitalize bg-slate-100 text-slate-600">{a.status?.replace('_', ' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t">
                      <td colSpan={4} className="px-4 py-2.5 text-xs text-right text-slate-500">Total Allocated</td>
                      <td className="px-4 py-2.5 font-bold text-teal-700">PKR {fmt(receipt.allocatedAmountPkr)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            )}
          </Card>

          {receipt.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600">{receipt.notes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Receipt Summary</p>
              {[
                { label: 'Receipt No', value: receipt.receiptNo },
                { label: 'Date', value: receipt.receiptDate },
                { label: 'Total Amount', value: `PKR ${fmt(receipt.totalAmountPkr)}`, bold: true },
                { label: 'Allocated', value: `PKR ${fmt(receipt.allocatedAmountPkr)}`, color: 'text-green-300' },
                { label: 'Unallocated', value: `PKR ${fmt(receipt.unallocatedAmountPkr)}`, color: parseFloat(receipt.unallocatedAmountPkr ?? '0') > 0 ? 'text-amber-300' : 'text-slate-300' },
                { label: 'Method', value: METHOD_LABEL[receipt.paymentMethod ?? ''] ?? receipt.paymentMethod ?? '—' },
                { label: 'Bank', value: receipt.bankName ?? '—' },
                { label: 'Branch', value: receipt.branchCode ?? '—' },
                { label: 'Cheque No', value: receipt.chequeNo ?? '—' },
                { label: 'Cheque Due', value: receipt.chequeDueDate ?? '—' },
                { label: 'Reference', value: receipt.referenceNo ?? '—' },
              ].map(({ label, value, bold, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className={`${bold ? 'font-bold text-white text-base' : color ?? 'text-white'} text-right`}>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-sm space-y-1">
              <p className="text-xs text-slate-400 mb-2">Customer</p>
              <p className="font-semibold text-slate-800">{receipt.customerName}</p>
              {receipt.customerBillingAddress && <p className="text-xs text-slate-500">{receipt.customerBillingAddress}</p>}
              {receipt.customerNtn && <p className="text-xs text-slate-400">NTN: {receipt.customerNtn}</p>}
            </CardContent>
          </Card>

          <PaymentActions receiptId={id} status={receipt.status ?? 'cleared'} />
        </div>
      </div>
    </div>
  );
}
