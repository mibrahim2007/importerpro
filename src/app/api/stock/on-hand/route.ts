import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockLedger, stockTransfers, stockTransferLines, products, warehouses, stockLocations } from '@/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouseId');
  const productId = searchParams.get('productId');

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Compute on-hand balance: SUM(qty) grouped by product, warehouse, location
  const balanceQuery = tdb
    .select({
      productId: stockLedger.productId,
      warehouseId: stockLedger.warehouseId,
      locationId: stockLedger.locationId,
      lotBatchNo: stockLedger.lotBatchNo,
      uom: stockLedger.uom,
      balance: sql<string>`SUM(${stockLedger.qty})`,
    })
    .from(stockLedger)
    .groupBy(
      stockLedger.productId,
      stockLedger.warehouseId,
      stockLedger.locationId,
      stockLedger.lotBatchNo,
      stockLedger.uom,
    )
    .$dynamic();

  const balances = await balanceQuery;

  // Filter balances with qty > 0 (or allow caller to see negative for short detection)
  const nonZero = balances.filter((b) => parseFloat(b.balance ?? '0') !== 0);

  // Compute in-transit: transfer_out from validated transfers that haven't been completed
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

  // Load product + warehouse + location metadata
  const productIds = [...new Set(nonZero.map((b) => b.productId))];
  const warehouseIds = [...new Set(nonZero.map((b) => b.warehouseId))];
  const locationIds = [...new Set(nonZero.map((b) => b.locationId).filter(Boolean))] as string[];

  const [productRows, warehouseRows, locationRows] = await Promise.all([
    productIds.length > 0
      ? tdb.select({ id: products.id, code: products.code, name: products.name, uom: products.uom, reorderPoint: products.reorderPoint, category: products.category }).from(products)
      : Promise.resolve([]),
    warehouseIds.length > 0
      ? tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses)
      : Promise.resolve([]),
    locationIds.length > 0
      ? tdb.select({ id: stockLocations.id, name: stockLocations.name, locationType: stockLocations.locationType }).from(stockLocations)
      : Promise.resolve([]),
  ]);

  const prodMap = Object.fromEntries((productRows as any[]).map((p: any) => [p.id, p]));
  const whMap = Object.fromEntries((warehouseRows as any[]).map((w: any) => [w.id, w]));
  const locMap = Object.fromEntries((locationRows as any[]).map((l: any) => [l.id, l]));

  // Enrich and filter
  let result = nonZero.map((b) => ({
    productId: b.productId,
    product: prodMap[b.productId] ?? null,
    warehouseId: b.warehouseId,
    warehouse: whMap[b.warehouseId] ?? null,
    locationId: b.locationId,
    location: b.locationId ? locMap[b.locationId] ?? null : null,
    lotBatchNo: b.lotBatchNo,
    uom: b.uom,
    balance: parseFloat(b.balance ?? '0'),
    inTransit: inTransitMap[b.productId]?.[b.warehouseId] ?? 0,
  }));

  if (warehouseId) result = result.filter((r) => r.warehouseId === warehouseId);
  if (productId) result = result.filter((r) => r.productId === productId);

  // Group by product for summary view
  const grouped: Record<string, { product: any; totalBalance: number; totalInTransit: number; lines: typeof result }> = {};
  for (const r of result) {
    if (!grouped[r.productId]) {
      grouped[r.productId] = { product: r.product, totalBalance: 0, totalInTransit: 0, lines: [] };
    }
    grouped[r.productId].totalBalance += r.balance;
    grouped[r.productId].totalInTransit += r.inTransit;
    grouped[r.productId].lines.push(r);
  }

  return NextResponse.json({ balances: Object.values(grouped) });
}
