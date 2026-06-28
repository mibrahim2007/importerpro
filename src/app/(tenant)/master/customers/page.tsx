import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers } from '@/db/schema';
import { redirect } from 'next/navigation';
import { ilike, or } from 'drizzle-orm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Pencil } from 'lucide-react';

const fbrColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  non_filer: 'bg-red-100 text-red-700',
  exempt: 'bg-slate-100 text-slate-500',
};

const stColors: Record<string, string> = {
  registered: 'bg-blue-100 text-blue-700',
  unregistered: 'bg-amber-100 text-amber-700',
  exempt: 'bg-slate-100 text-slate-500',
};

function formatPkr(val: string | null | undefined) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `PKR ${(n / 100_000).toFixed(1)}L`;
  return `PKR ${n.toLocaleString()}`;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { q } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  let query = tdb.select().from(customers).$dynamic();
  if (q) {
    query = query.where(or(
      ilike(customers.name, `%${q}%`),
      ilike(customers.code, `%${q}%`),
      ilike(customers.ntn, `%${q}%`),
    ));
  }
  const allCustomers = await query.orderBy(customers.name).limit(200);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{allCustomers.length} customers in master</p>
        </div>
        <Link href="/master/customers/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-1.5" /> Add Customer
          </Button>
        </Link>
      </div>

      <form className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, code, or NTN…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">Search</Button>
      </form>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">NTN</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">FBR Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Sales Tax</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Payment Terms</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Credit Limit</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">WHT%</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {allCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    {q ? `No customers matching "${q}"` : 'No customers yet.'}
                  </td>
                </tr>
              ) : (
                allCustomers.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.code ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.ntn ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${fbrColors[c.fbrStatus ?? 'active'] ?? 'bg-slate-100'}`}>
                        {(c.fbrStatus ?? 'active').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${stColors[c.salesTaxCategory ?? 'registered'] ?? 'bg-slate-100'}`}>
                        {c.salesTaxCategory ?? 'registered'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize text-xs">{(c.paymentTerms ?? '').replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-slate-600 text-xs">{formatPkr(c.creditLimitPkr)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.whtRatePct}%</td>
                    <td className="px-4 py-3">
                      <Link href={`/master/customers/${c.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
