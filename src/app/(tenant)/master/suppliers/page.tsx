import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { suppliers } from '@/db/schema';
import { redirect } from 'next/navigation';
import { ilike, or, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Pencil, Globe } from 'lucide-react';

const typeColors: Record<string, string> = {
  manufacturer: 'bg-blue-100 text-blue-700',
  trader: 'bg-amber-100 text-amber-700',
  clearing_agent: 'bg-slate-100 text-slate-600',
  freight_forwarder: 'bg-purple-100 text-purple-700',
  shipping_line: 'bg-sky-100 text-sky-700',
  port_agent: 'bg-orange-100 text-orange-700',
};

const complianceColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  blacklisted: 'bg-red-100 text-red-700',
  under_review: 'bg-amber-100 text-amber-700',
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { q, type } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  let query = tdb.select().from(suppliers).$dynamic();
  if (q) {
    query = query.where(or(ilike(suppliers.name, `%${q}%`), ilike(suppliers.code, `%${q}%`)));
  } else if (type) {
    query = query.where(eq(suppliers.supplierType, type as any));
  }
  const allSuppliers = await query.orderBy(suppliers.name).limit(200);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{allSuppliers.length} suppliers in master</p>
        </div>
        <Link href="/master/suppliers/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-1.5" /> Add Supplier
          </Button>
        </Link>
      </div>

      <form className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or code…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select name="type" defaultValue={type ?? ''} className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">All Types</option>
          <option value="manufacturer">Manufacturer</option>
          <option value="trader">Trader</option>
          <option value="clearing_agent">Clearing Agent</option>
          <option value="freight_forwarder">Freight Forwarder</option>
          <option value="shipping_line">Shipping Line</option>
          <option value="port_agent">Port Agent</option>
        </select>
        <Button type="submit" variant="outline" size="sm">Filter</Button>
      </form>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Country</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Payment Terms</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Lead Time</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Compliance</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {allSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    {q ? `No suppliers matching "${q}"` : 'No suppliers yet. Add your first supplier.'}
                  </td>
                </tr>
              ) : (
                allSuppliers.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.code ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Globe className="h-3.5 w-3.5" />
                        {s.country ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${typeColors[s.supplierType ?? 'manufacturer'] ?? 'bg-slate-100 text-slate-600'}`}>
                        {(s.supplierType ?? 'manufacturer').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{(s.paymentTerms ?? '').replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-500">{s.leadTimeDays ? `${s.leadTimeDays}d` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${complianceColors[s.complianceStatus ?? 'active'] ?? 'bg-slate-100 text-slate-500'}`}>
                        {s.complianceStatus ?? 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/master/suppliers/${s.id}/edit`}>
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
