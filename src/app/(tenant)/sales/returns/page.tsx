import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { returnAuthorizations, customers, salesInvoices } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

export default async function ReturnsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: returnAuthorizations.id,
      raNo: returnAuthorizations.raNo,
      raDate: returnAuthorizations.raDate,
      returnReason: returnAuthorizations.returnReason,
      status: returnAuthorizations.status,
      expectedReturnDate: returnAuthorizations.expectedReturnDate,
      createdAt: returnAuthorizations.createdAt,
      customerName: customers.name,
      invoiceNo: salesInvoices.invoiceNo,
    })
    .from(returnAuthorizations)
    .leftJoin(customers, eq(customers.id, returnAuthorizations.customerId))
    .leftJoin(salesInvoices, eq(salesInvoices.id, returnAuthorizations.invoiceId))
    .orderBy(desc(returnAuthorizations.createdAt)),

    tdb.select({
      total: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where status = 'draft')::int`,
      approved: sql<number>`count(*) filter (where status = 'approved')::int`,
      goodsReceived: sql<number>`count(*) filter (where status = 'goods_received')::int`,
      creditIssued: sql<number>`count(*) filter (where status = 'credit_issued')::int`,
    }).from(returnAuthorizations),
  ]);

  const s = stats[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customer Returns</h1>
          <p className="text-sm text-slate-500 mt-0.5">Return Authorizations (RA)</p>
        </div>
        <Link href="/sales/returns/new">
          <Button>+ New Return Authorization</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total RAs', value: s.total, color: 'bg-slate-50 border-slate-200' },
          { label: 'Draft', value: s.draft, color: 'bg-slate-50 border-slate-200' },
          { label: 'Approved', value: s.approved, color: 'bg-blue-50 border-blue-200' },
          { label: 'Goods Received', value: s.goodsReceived, color: 'bg-amber-50 border-amber-200' },
          { label: 'Credit Issued', value: s.creditIssued, color: 'bg-teal-50 border-teal-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['RA No', 'Date', 'Customer', 'Invoice', 'Reason', 'Exp. Return', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No return authorizations found</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-teal-700">
                  <Link href={`/sales/returns/${r.id}`} className="hover:underline">{r.raNo}</Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.raDate ? format(new Date(r.raDate), 'dd MMM yyyy') : '—'}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{r.customerName ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{r.invoiceNo ?? '—'}</td>
                <td className="px-4 py-3 text-slate-700">{REASON_LABELS[r.returnReason ?? ''] ?? r.returnReason}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.expectedReturnDate ? format(new Date(r.expectedReturnDate), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[r.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
                    {(r.status ?? 'draft').replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/sales/returns/${r.id}`} className="text-teal-600 hover:text-teal-800 text-xs font-medium">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
