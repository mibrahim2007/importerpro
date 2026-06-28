import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { products } from '@/db/schema';
import { redirect } from 'next/navigation';
import { ilike, or, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Pencil } from 'lucide-react';

const categoryColors: Record<string, string> = {
  raw_material: 'bg-blue-100 text-blue-700',
  packing: 'bg-amber-100 text-amber-700',
  consumable: 'bg-slate-100 text-slate-600',
  finished_good: 'bg-green-100 text-green-700',
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { q, category } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  let query = tdb.select().from(products).$dynamic();
  if (q) {
    query = query.where(or(ilike(products.name, `%${q}%`), ilike(products.code, `%${q}%`)));
  } else if (category) {
    query = query.where(eq(products.category, category as any));
  }
  const allProducts = await query.limit(200);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">{allProducts.length} items in master</p>
        </div>
        <Link href="/master/products/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-1.5" /> Add Product
          </Button>
        </Link>
      </div>

      {/* Search */}
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
        <select name="category" defaultValue={category ?? ''} className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">All Categories</option>
          <option value="raw_material">Raw Material</option>
          <option value="packing">Packing</option>
          <option value="consumable">Consumable</option>
          <option value="finished_good">Finished Good</option>
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
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">HS Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">UOM</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Reorder Pt</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {allProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    {q ? `No products matching "${q}"` : 'No products yet. Add your first product.'}
                  </td>
                </tr>
              ) : (
                allProducts.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.code ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${categoryColors[p.category ?? 'raw_material'] ?? 'bg-slate-100 text-slate-600'}`}>
                        {(p.category ?? 'raw_material').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.hsCode ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.uom}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{p.reorderPoint ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/master/products/${p.id}/edit`}>
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
