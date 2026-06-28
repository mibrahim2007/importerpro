import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockAdjustments, products, warehouses } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Plus, TrendingDown, TrendingUp } from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  count_correction: 'Count Correction',
  damage:   'Damage',
  spillage: 'Spillage',
  sampling: 'Sampling',
  expired:  'Expired',
  other:    'Other',
};

export const revalidate = 0;

export default async function AdjustmentsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [adjustments, productRows, warehouseRows] = await Promise.all([
    tdb.select().from(stockAdjustments).orderBy(desc(stockAdjustments.createdAt)),
    tdb.select({ id: products.id, name: products.name, code: products.code }).from(products),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
  ]);

  const prodMap = Object.fromEntries(productRows.map((p) => [p.id, p]));
  const whMap = Object.fromEntries(warehouseRows.map((w) => [w.id, w.name]));

  const stats = {
    total: adjustments.length,
    decreases: adjustments.filter((a) => parseFloat(a.qty) < 0).length,
    increases: adjustments.filter((a) => parseFloat(a.qty) > 0).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock Adjustments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Write-offs, count corrections, and additions</p>
        </div>
        <Link href="/warehouse/adjustments/new">
          <button className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Adjustment
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Adjustments', value: stats.total, icon: Package, color: 'text-slate-600' },
          { label: 'Write-offs (−)', value: stats.decreases, icon: TrendingDown, color: 'text-red-600' },
          { label: 'Additions (+)', value: stats.increases, icon: TrendingUp, color: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {adjustments.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No adjustments yet. Use adjustments to correct stock for damage, spillage, or count discrepancies.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Adj. No.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Warehouse</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Qty</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => {
                    const qty = parseFloat(a.qty);
                    const isNeg = qty < 0;
                    const prod = prodMap[a.productId];
                    return (
                      <tr key={a.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-600 text-xs">{a.adjNo}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(a.adjDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{prod?.name ?? '—'}</p>
                          {prod?.code && <p className="text-xs text-slate-400 font-mono">{prod.code}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{whMap[a.warehouseId] ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${isNeg ? 'text-red-600' : 'text-green-600'}`}>
                            {isNeg ? '' : '+'}{qty.toLocaleString()} {a.uom ?? ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{REASON_LABELS[a.reasonCode] ?? a.reasonCode}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{a.notes ?? '—'}</td>
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
