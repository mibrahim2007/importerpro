import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockLedger, products, warehouses, stockLocations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  const warehouseId = searchParams.get('warehouseId');
  const lotBatchNo = searchParams.get('lot');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const query = tdb.select().from(stockLedger).orderBy(desc(stockLedger.createdAt)).$dynamic();

  // Drizzle $dynamic() with conditional where would need .where chaining
  // Use raw select and filter in JS for simplicity
  const entries = await tdb.select().from(stockLedger).orderBy(desc(stockLedger.createdAt));

  const filtered = entries.filter((e) => {
    if (productId && e.productId !== productId) return false;
    if (warehouseId && e.warehouseId !== warehouseId) return false;
    if (lotBatchNo && e.lotBatchNo !== lotBatchNo) return false;
    return true;
  }).slice(0, 500);

  const productIds = [...new Set(filtered.map((e) => e.productId))];
  const warehouseIds = [...new Set(filtered.map((e) => e.warehouseId))];
  const locationIds = [...new Set(filtered.map((e) => e.locationId).filter(Boolean))] as string[];

  const [productRows, warehouseRows, locationRows] = await Promise.all([
    tdb.select({ id: products.id, name: products.name, code: products.code }).from(products),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
    tdb.select({ id: stockLocations.id, name: stockLocations.name }).from(stockLocations),
  ]);

  const prodMap = Object.fromEntries(productRows.map((p) => [p.id, p]));
  const whMap = Object.fromEntries(warehouseRows.map((w) => [w.id, w]));
  const locMap = Object.fromEntries(locationRows.map((l) => [l.id, l]));

  const enriched = filtered.map((e) => ({
    ...e,
    product: prodMap[e.productId] ?? null,
    warehouse: whMap[e.warehouseId] ?? null,
    location: e.locationId ? locMap[e.locationId] ?? null : null,
  }));

  return NextResponse.json({ entries: enriched });
}
