import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { vendorBills } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, FileText, Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft:          'bg-slate-100 text-slate-500',
  posted:         'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid:           'bg-green-100 text-green-700',
  cancelled:      'bg-slate-100 text-slate-400',
};

const BILL_TYPE_LABEL: Record<string, string> = {
  supplier_goods:  'Supplier Goods',
  clearing_agent:  'Clearing Agent',
  freight:         'Freight',
  port_charges:    'Port Charges',
  bank_lc:         'Bank / LC',
  other:           'Other',
};

const fmt = (v: string | null | undefined) =>
  v ? `PKR ${parseFloat(v).toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : '—';

export const revalidate = 0;

export default async function BillsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const bills = await tdb.select().from(vendorBills).orderBy(desc(vendorBills.billDate));

  const today = new Date();

  const overdue = bills.filter((b) => {
    if (!b.dueDate || b.status === 'paid' || b.status === 'cancelled') return false;
    return new Date(b.dueDate) < today;
  });

  // AP Aging buckets (based on balanceDue > 0)
  const open = bills.filter((b) => !['paid', 'cancelled'].includes(b.status ?? 'draft'));
  const aging = {
    current: open.filter((b) => !b.dueDate || (new Date(b.dueDate) >= today)),
    '1_30': open.filter((b) => b.dueDate && diffDays(today, new Date(b.dueDate)) <= 30 && diffDays(today, new Date(b.dueDate)) >= 1),
    '31_60': open.filter((b) => b.dueDate && diffDays(today, new Date(b.dueDate)) > 30 && diffDays(today, new Date(b.dueDate)) <= 60),
    '61_90': open.filter((b) => b.dueDate && diffDays(today, new Date(b.dueDate)) > 60 && diffDays(today, new Date(b.dueDate)) <= 90),
    over90: open.filter((b) => b.dueDate && diffDays(today, new Date(b.dueDate)) > 90),
  };

  const totalOutstanding = open.reduce((s, b) => s + parseFloat(b.balanceDue ?? '0'), 0);
  const totalOverdue = overdue.reduce((s, b) => s + parseFloat(b.balanceDue ?? '0'), 0);

  const stats = {
    total: bills.length,
    draft: bills.filter((b) => b.status === 'draft').length,
    open: open.length,
    paid: bills.filter((b) => b.status === 'paid').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vendor Bills</h1>
          <p className="text-sm text-slate-500 mt-0.5">Accounts payable — supplier goods, clearing, freight, port, bank charges</p>
        </div>
        <Link href="/finance/bills/new">
          <button className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Bill
          </button>
        </Link>
      </div>

      {/* AP Aging Summary */}
      <Card className="bg-slate-800 border-0">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white">Accounts Payable Aging</p>
            <p className="text-lg font-bold text-teal-300">{fmt(String(totalOutstanding))} outstanding</p>
          </div>
          <div className="grid grid-cols-5 gap-3 text-center text-xs">
            {[
              { label: 'Current', count: aging.current.length, color: 'text-green-400' },
              { label: '1–30 days', count: aging['1_30'].length, color: 'text-amber-400' },
              { label: '31–60 days', count: aging['31_60'].length, color: 'text-orange-400' },
              { label: '61–90 days', count: aging['61_90'].length, color: 'text-red-400' },
              { label: '90+ days', count: aging.over90.length, color: 'text-red-300' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-slate-700 rounded-lg p-3">
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 text-sm">{overdue.length} overdue bill{overdue.length > 1 ? 's' : ''} — {fmt(String(totalOverdue))} unpaid</p>
            <p className="text-xs text-red-500 mt-0.5">{overdue.map((b) => b.billNo).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'All Bills', value: stats.total, icon: FileText, color: 'text-slate-600' },
          { label: 'Draft', value: stats.draft, icon: Clock, color: 'text-slate-400' },
          { label: 'Open / Unpaid', value: stats.open, icon: AlertCircle, color: 'text-amber-600' },
          { label: 'Paid', value: stats.paid, icon: CheckCircle2, color: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bills table */}
      {bills.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No bills yet. Create a bill to track payables to suppliers and service providers.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Bill No.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Total (PKR)</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Balance Due</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Due Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => {
                    const isOverdue = b.dueDate && !['paid','cancelled'].includes(b.status ?? '') && new Date(b.dueDate) < today;
                    return (
                      <tr key={b.id} className={`border-b hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3">
                          <Link href={`/finance/bills/${b.id}`} className="font-mono text-teal-600 hover:underline text-sm">
                            {b.billNo}
                          </Link>
                          {b.supplierInvoiceNo && <p className="text-xs text-slate-400">{b.supplierInvoiceNo}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {new Date(b.billDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{b.supplierName}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{BILL_TYPE_LABEL[b.billType] ?? b.billType}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(b.totalAmountPkr ?? b.totalAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {parseFloat(b.balanceDue ?? '0') > 0 ? fmt(b.balanceDue) : <span className="text-green-600">Paid</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {b.dueDate ? (
                            <span className={isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}>
                              {new Date(b.dueDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[b.status ?? 'draft']}`}>
                            {(b.status ?? 'draft').replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function diffDays(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
