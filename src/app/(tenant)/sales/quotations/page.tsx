import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesQuotations, customers } from '@/db/schema';
import { desc, eq, count } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { QuotationListClient } from '@/components/sales/quotation-list-client';

export const revalidate = 0;

export default async function QuotationsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: salesQuotations.id, quotationNo: salesQuotations.quotationNo,
      revisionNo: salesQuotations.revisionNo, date: salesQuotations.date,
      validUntil: salesQuotations.validUntil, status: salesQuotations.status,
      grandTotalPkr: salesQuotations.grandTotalPkr, paymentTerms: salesQuotations.paymentTerms,
      createdAt: salesQuotations.createdAt,
      customerName: customers.name, customerCode: customers.code,
    })
    .from(salesQuotations)
    .leftJoin(customers, eq(customers.id, salesQuotations.customerId))
    .orderBy(desc(salesQuotations.createdAt)),

    tdb.select({ status: salesQuotations.status, cnt: count() })
      .from(salesQuotations).groupBy(salesQuotations.status),
  ]);

  const byStatus = Object.fromEntries(stats.map((s) => [s.status, Number(s.cnt)]));
  const totalValue = rows
    .filter((r) => r.status !== 'cancelled' && r.status !== 'rejected')
    .reduce((s, r) => s + parseFloat(r.grandTotalPkr ?? '0'), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sales Quotations</h1>
          <p className="text-sm text-slate-500">Formal offers sent to customers</p>
        </div>
        <Link href="/sales/quotations/new">
          <Button className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1.5 h-4 w-4" />New Quotation</Button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Quotations', value: rows.length },
          { label: 'Open (Sent)', value: byStatus['sent'] ?? 0 },
          { label: 'Accepted', value: byStatus['accepted'] ?? 0 },
          { label: 'Pipeline Value', value: `PKR ${(totalValue / 1000).toFixed(0)}K` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <QuotationListClient rows={rows} />
    </div>
  );
}
