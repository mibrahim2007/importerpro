import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { purchaseReturnAuthorizations, suppliers, purchaseOrders, grns } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export const revalidate = 0;

const REASON_LABELS: Record<string, string> = {
  quality_issue: 'Quality Issue',
  wrong_product: 'Wrong Product',
  damaged: 'Damaged Goods',
  short_supply: 'Short Supply',
  price_dispute: 'Price Dispute',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  approved: 'bg-blue-100 text-blue-700',
  goods_dispatched: 'bg-amber-100 text-amber-700',
  debit_issued: 'bg-teal-100 text-teal-700',
  closed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default async function PurchaseReturnsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: purchaseReturnAuthorizations.id,
      praNo: purchaseReturnAuthorizations.praNo,
      praDate: purchaseReturnAuthorizations.praDate,
      returnReason: purchaseReturnAuthorizations.returnReason,
      status: purchaseReturnAuthorizations.status,
      expectedDispatchDate: purchaseReturnAuthorizations.expectedDispatchDate,
      createdAt: purchaseReturnAuthorizations.createdAt,
      supplierName: suppliers.name,
      poNo: purchaseOrders.poNo,
      grnNo: grns.grnNo,
    })
    .from(purchaseReturnAuthorizations)
    .leftJoin(suppliers, eq(suppliers.id, purchaseReturnAuthorizations.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, purchaseReturnAuthorizations.poId))
    .leftJoin(grns, eq(grns.id, purchaseReturnAuthorizations.grnId))
    .orderBy(desc(purchaseReturnAuthorizations.createdAt)),

    tdb.select({
      total: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where status = 'draft')::int`,
      approved: sql<number>`count(*) filter (where status = 'approved')::int`,
      dispatched: sql<number>`count(*) filter (where status = 'goods_dispatched')::int`,
      debitIssued: sql<number>`count(*) filter (where status = 'debit_issued')::int`,
    }).from(purchaseReturnAuthorizations),
  ]);

  const s = stats[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchase Returns</h1>
          <p className="text-sm text-slate-500 mt-0.5">Purchase Return Authorizations (PRA)</p>
        </div>
        <Link href="/import/returns/new">
          <Button>+ New Return Authorization</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total PRAs', value: s.total },
          { label: 'Draft', value: s.draft },
          { label: 'Approved', value: s.approved },
          { label: 'Goods Dispatched', value: s.dispatched },
          { label: 'Debit Issued', value: s.debitIssued },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
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
              {['PRA No', 'Date', 'Supplier', 'Linked PO', 'GRN', 'Reason', 'Exp. Dispatch', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No purchase return authorizations found</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-teal-700">
                  <Link href={`/import/returns/${r.id}`} className="hover:underline">{r.praNo}</Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.praDate ? format(new Date(r.praDate), 'dd MMM yyyy') : '—'}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{r.supplierName ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{r.poNo ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-500 text-xs">{r.grnNo ?? '—'}</td>
                <td className="px-4 py-3 text-slate-700">{REASON_LABELS[r.returnReason ?? ''] ?? r.returnReason}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.expectedDispatchDate ? format(new Date(r.expectedDispatchDate), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[r.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
                    {(r.status ?? 'draft').replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/import/returns/${r.id}`} className="text-teal-600 hover:text-teal-800 text-xs font-medium">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
