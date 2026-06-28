import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { vendorBills, suppliers } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  posted: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const APP_TYPE_LABELS: Record<string, string> = {
  applied_to_bill: 'Applied to Bill',
  supplier_credit: 'Supplier Credit',
};

export default async function DebitNotesPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: vendorBills.id,
      billNo: vendorBills.billNo,
      billDate: vendorBills.billDate,
      praId: vendorBills.praId,
      linkedBillId: vendorBills.linkedBillId,
      debitApplicationType: vendorBills.debitApplicationType,
      status: vendorBills.status,
      currency: vendorBills.currency,
      totalAmount: vendorBills.totalAmount,
      totalAmountPkr: vendorBills.totalAmountPkr,
      balanceDue: vendorBills.balanceDue,
      createdAt: vendorBills.createdAt,
      supplierName: suppliers.name,
    })
    .from(vendorBills)
    .leftJoin(suppliers, eq(suppliers.id, vendorBills.supplierId))
    .where(eq(vendorBills.billType, 'debit_note'))
    .orderBy(desc(vendorBills.createdAt)),

    tdb.select({
      total: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where status = 'draft')::int`,
      posted: sql<number>`count(*) filter (where status = 'posted')::int`,
      totalValuePkr: sql<string>`coalesce(sum(total_amount_pkr) filter (where status = 'posted'), 0)::text`,
    })
    .from(vendorBills)
    .where(eq(vendorBills.billType, 'debit_note')),
  ]);

  const s = stats[0];
  const totalValuePkr = parseFloat(String(s.totalValuePkr ?? 0));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Debit Notes</h1>
          <p className="text-sm text-slate-500 mt-0.5">DN-YYYY-NNNN · Reduces supplier payable</p>
        </div>
        <Link href="/import/debit-notes/new">
          <Button>+ New Debit Note</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total DNs', display: String(s.total ?? 0) },
          { label: 'Draft', display: String(s.draft ?? 0) },
          { label: 'Posted', display: String(s.posted ?? 0) },
          { label: 'Total Debit Value (PKR)', display: `PKR ${totalValuePkr.toLocaleString('en-PK', { minimumFractionDigits: 0 })}` },
        ].map(({ label, display }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{display}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['DN No', 'Date', 'Supplier', 'Currency', 'Amount', 'PKR Value', 'Application', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No debit notes found</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-teal-700">
                  <Link href={`/import/debit-notes/${r.id}`} className="hover:underline">{r.billNo}</Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.billDate ? format(new Date(r.billDate), 'dd MMM yyyy') : '—'}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{r.supplierName ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 font-mono">{r.currency}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{parseFloat(r.totalAmount ?? '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right tabular-nums">PKR {parseFloat(r.totalAmountPkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{APP_TYPE_LABELS[r.debitApplicationType ?? ''] ?? r.debitApplicationType ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
                    {r.status ?? 'draft'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/import/debit-notes/${r.id}`} className="text-teal-600 hover:text-teal-800 text-xs font-medium">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
