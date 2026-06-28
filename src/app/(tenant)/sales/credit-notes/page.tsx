import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { salesInvoices, customers } from '@/db/schema';
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
  applied_to_invoice: 'Applied to Invoice',
  refund: 'Refund',
};

export default async function CreditNotesPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: salesInvoices.id,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      status: salesInvoices.status,
      creditApplicationType: salesInvoices.creditApplicationType,
      subtotalPkr: salesInvoices.subtotalPkr,
      salesTaxPkr: salesInvoices.salesTaxPkr,
      grandTotalPkr: salesInvoices.grandTotalPkr,
      raId: salesInvoices.raId,
      linkedInvoiceId: salesInvoices.linkedInvoiceId,
      createdAt: salesInvoices.createdAt,
      customerName: customers.name,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(eq(salesInvoices.invoiceType, 'credit_note'))
    .orderBy(desc(salesInvoices.createdAt)),

    tdb.select({
      total: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where status = 'draft')::int`,
      posted: sql<number>`count(*) filter (where status = 'posted')::int`,
      totalValue: sql<number>`coalesce(sum(grand_total_pkr) filter (where status = 'posted'), 0)::numeric`,
    })
    .from(salesInvoices)
    .where(eq(salesInvoices.invoiceType, 'credit_note')),
  ]);

  const s = stats[0];
  const totalValue = parseFloat(String(s.totalValue ?? 0));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Credit Notes</h1>
          <p className="text-sm text-slate-500 mt-0.5">CN-YYYY-NNNN · FBR-reported</p>
        </div>
        <Link href="/sales/credit-notes/new">
          <Button>+ New Credit Note</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total CNs', value: s.total, display: String(s.total ?? 0) },
          { label: 'Draft', value: s.draft, display: String(s.draft ?? 0) },
          { label: 'Posted', value: s.posted, display: String(s.posted ?? 0) },
          { label: 'Total Credit Value', value: totalValue, display: `PKR ${totalValue.toLocaleString('en-PK', { minimumFractionDigits: 0 })}` },
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
              {['CN No', 'Date', 'Customer', 'Subtotal (PKR)', 'Sales Tax (PKR)', 'Total (PKR)', 'Application', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No credit notes found</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-teal-700">
                  <Link href={`/sales/credit-notes/${r.id}`} className="hover:underline">{r.invoiceNo}</Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.invoiceDate ? format(new Date(r.invoiceDate), 'dd MMM yyyy') : '—'}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{r.customerName ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{parseFloat(r.subtotalPkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right tabular-nums text-blue-700">{parseFloat(r.salesTaxPkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{parseFloat(r.grandTotalPkr ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{APP_TYPE_LABELS[r.creditApplicationType ?? ''] ?? r.creditApplicationType ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>
                    {r.status ?? 'draft'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/sales/credit-notes/${r.id}`} className="text-teal-600 hover:text-teal-800 text-xs font-medium">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
