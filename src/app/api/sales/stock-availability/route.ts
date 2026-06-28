import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockLedger, stockReservations, products, warehouses } from '@/db/schema';
import { sql, eq, and, inArray } from 'drizzle-orm';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouseId');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const ledgerQ = tdb
    .select({
      productId: stockLedger.productId,
      warehouseId: stockLedger.warehouseId,
      onHand: sql<number>`SUM(${stockLedger.qty})::numeric`,
    })
    .from(stockLedger)
    .groupBy(stockLedger.productId, stockLedger.warehouseId)
    .having(sql`SUM(${stockLedger.qty}) > 0`);

  const reservedQ = tdb
    .select({
      productId: stockReservations.productId,
      warehouseId: stockReservations.warehouseId,
      totalReserved: sql<number>`SUM(${stockReservations.reservedQty} - ${stockReservations.releasedQty})::numeric`,
    })
    .from(stockReservations)
    .where(inArray(stockReservations.status, ['reserved', 'partially_released']))
    .groupBy(stockReservations.productId, stockReservations.warehouseId);

  const [ledger, reserved] = await Promise.all([ledgerQ, reservedQ]);

  const reservedMap = new Map(
    reserved.map((r) => [`${r.productId}|${r.warehouseId}`, Number(r.totalReserved)]),
  );

  const result = ledger.map((r) => {
    const key = `${r.productId}|${r.warehouseId}`;
    const res = reservedMap.get(key) ?? 0;
    return {
      productId: r.productId,
      warehouseId: r.warehouseId,
      onHand: Number(r.onHand),
      reserved: res,
      available: Math.max(0, Number(r.onHand) - res),
    };
  }).filter((r) => !warehouseId || r.warehouseId === warehouseId);

  return NextResponse.json(result);
}
