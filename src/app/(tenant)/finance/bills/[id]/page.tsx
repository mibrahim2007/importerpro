import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { vendorBills, vendorBillLines, payments, purchaseOrders, grns, shipments, letterOfCredits, chartOfAccounts } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { BillPaymentPanel } from '@/components/finance/bill-payment-panel';
import { BillStatusActions } from '@/components/finance/bill-status-actions';

const STATUS_BADGE: Record<string, string> = {
  draft:          'bg-slate-100 text-slate-500',
  posted:         'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid:           'bg-green-100 text-green-700',
  cancelled:      'bg-slate-100 text-slate-400',
};

const BILL_TYPE_LABEL: Record<string, string> = {
  supplier_goods: 'Supplier Goods', clearing_agent: 'Clearing Agent',
  freight: 'Freight', port_charges: 'Port Charges', bank_lc: 'Bank / LC', other: 'Other',
};

const fmt = (v: string | null | undefined) =>
  v ? parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '0.00';

export const revalidate = 0;

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[bill], lines, billPayments] = await Promise.all([
    tdb.select().from(vendorBills).where(eq(vendorBills.id, id)).limit(1),
    tdb.select().from(vendorBillLines).where(eq(vendorBillLines.billId, id)).orderBy(asc(vendorBillLines.sortOrder)),
    tdb.select().from(payments).where(eq(payments.billId, id)).orderBy(asc(payments.paymentDate)),
  ]);

  if (!bill) notFound();

  const [poRow, grnRow, shipRow, lcRow, accounts] = await Promise.all([
    bill.poId ? tdb.select({ poNo: purchaseOrders.poNo }).from(purchaseOrders).where(eq(purchaseOrders.id, bill.poId)).limit(1) : Promise.resolve([]),
    bill.grnId ? tdb.select({ grnNo: grns.grnNo }).from(grns).where(eq(grns.id, bill.grnId)).limit(1) : Promise.resolve([]),
    bill.shipmentId ? tdb.select({ shipmentNo: shipments.shipmentNo }).from(shipments).where(eq(shipments.id, bill.shipmentId)).limit(1) : Promise.resolve([]),
    bill.lcId ? tdb.select({ lcNo: letterOfCredits.lcNo }).from(letterOfCredits).where(eq(letterOfCredits.id, bill.lcId)).limit(1) : Promise.resolve([]),
    tdb.select({ code: chartOfAccounts.code, name: chartOfAccounts.name }).from(chartOfAccounts),
  ]);

  const accMap = Object.fromEntries(accounts.map((a) => [a.code, a.name]));
  const today = new Date();
  const isOverdue = bill.dueDate && !['paid', 'cancelled'].includes(bill.status ?? '') && new Date(bill.dueDate) < today;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/finance/bills">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-mono font-bold text-slate-900">{bill.billNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[bill.status ?? 'draft']}`}>
                {(bill.status ?? 'draft').replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">{BILL_TYPE_LABEL[bill.billType] ?? bill.billType}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="font-medium text-slate-600">{bill.supplierName}</span>
              {(poRow as any)[0] && <Link href={`/import/purchase-orders/${bill.poId}`} className="font-mono text-teal-600 hover:underline">{(poRow as any)[0].poNo}</Link>}
              {(shipRow as any)[0] && <Link href={`/import/shipments/${bill.shipmentId}`} className="font-mono text-indigo-600 hover:underline">{(shipRow as any)[0].shipmentNo}</Link>}
              {(grnRow as any)[0] && <Link href={`/import/grn/${bill.grnId}`} className="font-mono text-slate-500 hover:underline">{(grnRow as any)[0].grnNo}</Link>}
            </div>
          </div>
        </div>
      </div>

      <BillStatusActions billId={id} status={bill.status ?? 'draft'} />

      {isOverdue && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-red-700 font-medium">Overdue — payment was due {new Date(bill.dueDate!).toLocaleDateString('en-PK')}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bill Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Bill Date', value: new Date(bill.billDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) },
                { label: 'Due Date', value: bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
                { label: 'Supplier Invoice No.', value: bill.supplierInvoiceNo ?? '—', mono: true },
                { label: 'Supplier Invoice Date', value: bill.supplierInvoiceDate ? new Date(bill.supplierInvoiceDate).toLocaleDateString('en-PK') : '—' },
                { label: 'Currency', value: bill.currency ?? 'PKR' },
                { label: 'Exchange Rate', value: bill.currency !== 'PKR' ? `1 ${bill.currency} = PKR ${bill.exchangeRate}` : '—' },
              ].map(({ label, value, mono }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className={`font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
              {bill.notes && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Notes</p>
                  <p className="text-slate-600 text-sm">{bill.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Line Items</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-2 font-medium text-slate-500">Description</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-500">Account</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500">Amount</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500">Tax</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="px-4 py-3 text-slate-800">{l.description}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{l.accountCode ? `${l.accountCode} — ${accMap[l.accountCode] ?? ''}` : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{bill.currency} {fmt(l.amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{parseFloat(l.taxPct ?? '0') > 0 ? `${l.taxPct}%` : '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{bill.currency} {fmt(l.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="px-4 py-2 text-right font-semibold text-slate-600">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-900">{bill.currency} {fmt(bill.totalAmount)}</td>
                  </tr>
                  {bill.currency !== 'PKR' && (
                    <tr className="bg-teal-50">
                      <td colSpan={4} className="px-4 py-1.5 text-right text-xs text-teal-600">Total (PKR)</td>
                      <td className="px-4 py-1.5 text-right font-bold text-teal-700">PKR {fmt(bill.totalAmountPkr)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {/* Payments log */}
          {billPayments.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Payment History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Date</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Type</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Ref</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-500">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billPayments.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="px-4 py-2 text-slate-600">{new Date(p.paymentDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-2 text-slate-500 capitalize">{p.paymentType?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-xs text-slate-400 font-mono">{p.bankRef ?? p.paymentNo}</td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">PKR {fmt(p.amountPkr ?? p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Payment Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bill Total</span>
                  <span className="text-white font-medium">PKR {fmt(bill.totalAmountPkr ?? bill.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Paid</span>
                  <span className="text-green-400 font-medium">PKR {fmt(bill.totalPaid)}</span>
                </div>
                <div className="border-t border-slate-600 pt-2 flex justify-between">
                  <span className="text-white font-semibold">Balance Due</span>
                  <span className={`font-bold text-lg ${parseFloat(bill.balanceDue ?? '0') > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    PKR {fmt(bill.balanceDue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <BillPaymentPanel
            billId={id}
            status={bill.status ?? 'draft'}
            balanceDue={bill.balanceDue ?? bill.totalAmount}
            currency={bill.currency ?? 'PKR'}
          />

          {/* 3-way match */}
          {bill.billType === 'supplier_goods' && (
            <Card className={`border ${bill.matchStatus === 'matched' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              <CardContent className="p-4 flex gap-2.5">
                {bill.matchStatus === 'matched'
                  ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />}
                <div>
                  <p className={`font-semibold text-sm ${bill.matchStatus === 'matched' ? 'text-green-700' : 'text-amber-700'}`}>
                    3-Way Match: {bill.matchStatus === 'matched' ? 'Matched' : 'Pending'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {bill.poId ? '✓ PO linked' : '✗ No PO'}
                    {' · '}
                    {bill.grnId ? '✓ GRN linked' : '✗ No GRN'}
                    {' · '}
                    {bill.supplierInvoiceNo ? '✓ Invoice' : '✗ No invoice'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
