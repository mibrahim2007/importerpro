import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockLedger, stockTransfers, stockTransferLines, products, warehouses, stockLocations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ArrowRightLeft, Package, TrendingDown } from 'lucide-react';

const CATEGORY_BADGE: Record<string, string> = {
  raw_material: 'bg-blue-100 text-blue-700',
  packing:      'bg-purple-100 text-purple-700',
  consumable:   'bg-slate-100 text-slate-600',
};

export const revalidate = 0;

export default async function StockOnHandPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Compute balances per product+warehouse+location+lot
  const balances = await tdb
    .select({
      productId: stockLedger.productId,
      warehouseId: stockLedger.warehouseId,
      locationId: stockLedger.locationId,
      lotBatchNo: stockLedger.lotBatchNo,
      uom: stockLedger.uom,
      balance: sql<string>`SUM(${stockLedger.qty})`,
    })
    .from(stockLedger)
    .groupBy(stockLedger.productId, stockLedger.warehouseId, stockLedger.locationId, stockLedger.lotBatchNo, stockLedger.uom);

  const nonZero = balances.filter((b) => parseFloat(b.balance ?? '0') !== 0);

  // In-transit from validated transfers
  const inTransitRows = await tdb
    .select({
      productId: stockTransferLines.productId,
      fromWarehouseId: stockTransfers.fromWarehouseId,
      inTransit: sql<string>`SUM(${stockTransferLines.requestedQty})`,
    })
    .from(stockTransferLines)
    .innerJoin(stockTransfers, eq(stockTransferLines.transferId, stockTransfers.id))
    .where(eq(stockTransfers.status, 'validated'))
    .groupBy(stockTransferLines.productId, stockTransfers.fromWarehouseId);

  const inTransitMap: Record<string, Record<string, number>> = {};
  for (const r of inTransitRows) {
    if (!inTransitMap[r.productId]) inTransitMap[r.productId] = {};
    inTransitMap[r.productId][r.fromWarehouseId] = parseFloat(r.inTransit ?? '0');
  }

  // Load metadata
  const [productRows, warehouseRows, locationRows] = await Promise.all([
    tdb.select({ id: products.id, code: products.code, name: products.name, uom: products.uom, reorderPoint: products.reorderPoint, minStock: products.minStock, category: products.category }).from(products),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
    tdb.select({ id: stockLocations.id, name: stockLocations.name, locationType: stockLocations.locationType }).from(stockLocations),
  ]);

  const prodMap = Object.fromEntries(productRows.map((p) => [p.id, p]));
  const whMap = Object.fromEntries(warehouseRows.map((w) => [w.id, w]));
  const locMap = Object.fromEntries(locationRows.map((l) => [l.id, l]));

  // Group by product
  type ProdGroup = {
    product: typeof productRows[0];
    totalBalance: number;
    totalInTransit: number;
    lines: Array<{ warehouse: typeof warehouseRows[0] | undefined; location: typeof locationRows[0] | undefined; lot: string | null; uom: string | null; balance: number }>;
  };

  const grouped: Record<string, ProdGroup> = {};
  for (const b of nonZero) {
    const product = prodMap[b.productId];
    if (!product) continue;
    if (!grouped[b.productId]) grouped[b.productId] = { product, totalBalance: 0, totalInTransit: 0, lines: [] };
    const bal = parseFloat(b.balance ?? '0');
    grouped[b.productId].totalBalance += bal;
    grouped[b.productId].totalInTransit += inTransitMap[b.productId]?.[b.warehouseId] ?? 0;
    grouped[b.productId].lines.push({ warehouse: whMap[b.warehouseId], location: b.locationId ? locMap[b.locationId] : undefined, lot: b.lotBatchNo, uom: b.uom, balance: bal });
  }

  const rows = Object.values(grouped).sort((a, b) => a.product.name.localeCompare(b.product.name));
  const belowReorder = rows.filter((r) => parseFloat(r.product.reorderPoint ?? '0') > 0 && r.totalBalance < parseFloat(r.product.reorderPoint ?? '0'));

  const stats = {
    totalProducts: rows.length,
    totalInTransit: inTransitRows.length,
    belowReorder: belowReorder.length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock on Hand</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time inventory balances across all locations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/warehouse/transfers/new">
            <button className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5">
              <ArrowRightLeft className="h-4 w-4" /> New Transfer
            </button>
          </Link>
          <Link href="/warehouse/adjustments/new">
            <button className="px-3 py-2 rounded-lg text-sm font-medium border text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
              <Package className="h-4 w-4" /> Adjust Stock
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Products in Stock', value: stats.totalProducts, color: 'text-teal-600' },
          { label: 'In-Transit Transfers', value: stats.totalInTransit, color: 'text-indigo-600' },
          { label: 'Below Reorder Level', value: stats.belowReorder, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reorder alert */}
      {belowReorder.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 text-sm">{belowReorder.length} product{belowReorder.length > 1 ? 's' : ''} below reorder level</p>
            <p className="text-xs text-red-500 mt-0.5">{belowReorder.map((r) => r.product.name).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Stock table */}
      {rows.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No stock on hand yet. Post a GRN to see inventory here.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 w-8"></th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">On Hand</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">In Transit</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Reorder Pt.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">UOM</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Locations</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const reorderPt = parseFloat(r.product.reorderPoint ?? '0');
                    const minStock = parseFloat(r.product.minStock ?? '0');
                    const isBelowReorder = reorderPt > 0 && r.totalBalance < reorderPt;
                    const isBelowMin = minStock > 0 && r.totalBalance < minStock;
                    return (
                      <tr key={r.product.id} className={`border-b hover:bg-slate-50 ${isBelowMin ? 'bg-red-50' : isBelowReorder ? 'bg-amber-50' : ''}`}>
                        <td className="px-4 py-3">
                          {(isBelowMin || isBelowReorder) && <TrendingDown className={`h-4 w-4 ${isBelowMin ? 'text-red-500' : 'text-amber-500'}`} />}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{r.product.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{r.product.code}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE[r.product.category ?? 'raw_material']}`}>
                            {(r.product.category ?? 'raw_material').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {r.totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-indigo-600 font-medium">
                          {r.totalInTransit > 0 ? r.totalInTransit.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 text-xs">
                          {reorderPt > 0 ? reorderPt.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{r.product.uom ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {[...new Set(r.lines.map((l) => l.warehouse?.name).filter(Boolean))].join(', ')}
                        </td>
                        <td className="px-4 py-3">
                          {isBelowMin ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Critical</span>
                          ) : isBelowReorder ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">Reorder</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">OK</span>
                          )}
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
