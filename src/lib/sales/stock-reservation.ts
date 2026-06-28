import { sql, eq, and, inArray } from 'drizzle-orm';
import { stockLedger, stockReservations, salesOrderLines } from '@/db/schema';
import type { TenantDb } from '@/db';

interface LotRow {
  lotBatchNo: string | null;
  expiryDate: string | null;
  available: number;
}

/** Returns on-hand qty per lot for a product+warehouse, minus existing active reservations (FEFO sorted). */
export async function getAvailableLots(
  tdb: TenantDb,
  productId: string,
  warehouseId: string,
): Promise<LotRow[]> {
  const ledgerRows = await tdb
    .select({
      lotBatchNo: stockLedger.lotBatchNo,
      expiryDate: stockLedger.expiryDate,
      onHand: sql<number>`SUM(${stockLedger.qty})::numeric`,
    })
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.productId, productId),
        eq(stockLedger.warehouseId, warehouseId),
      ),
    )
    .groupBy(stockLedger.lotBatchNo, stockLedger.expiryDate)
    .having(sql`SUM(${stockLedger.qty}) > 0`);

  // Get active reservations for this product+warehouse
  const reservedRows = await tdb
    .select({
      lotBatchNo: stockReservations.lotBatchNo,
      expiryDate: stockReservations.expiryDate,
      reserved: sql<number>`SUM(${stockReservations.reservedQty} - ${stockReservations.releasedQty})::numeric`,
    })
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.productId, productId),
        eq(stockReservations.warehouseId, warehouseId),
        inArray(stockReservations.status, ['reserved', 'partially_released']),
      ),
    )
    .groupBy(stockReservations.lotBatchNo, stockReservations.expiryDate);

  const reservedMap = new Map(
    reservedRows.map((r) => [`${r.lotBatchNo}|${r.expiryDate}`, Number(r.reserved)]),
  );

  return ledgerRows
    .map((r) => {
      const key = `${r.lotBatchNo}|${r.expiryDate}`;
      const reserved = reservedMap.get(key) ?? 0;
      return {
        lotBatchNo: r.lotBatchNo,
        expiryDate: r.expiryDate,
        available: Number(r.onHand) - reserved,
      };
    })
    .filter((r) => r.available > 0)
    .sort((a, b) => {
      // FEFO: null expiry last
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
}

/** Reserves stock FEFO for a single SO line. Returns reservedQty and backorderQty. */
export async function reserveStock(
  tdb: TenantDb,
  soId: string,
  lineId: string,
  productId: string,
  warehouseId: string,
  neededQty: number,
): Promise<{ reservedQty: number; backorderQty: number }> {
  const lots = await getAvailableLots(tdb, productId, warehouseId);
  let remaining = neededQty;
  let totalReserved = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.available);
    await tdb.insert(stockReservations).values({
      soId, soLineId: lineId, productId, warehouseId,
      lotBatchNo: lot.lotBatchNo,
      expiryDate: lot.expiryDate,
      reservedQty: String(take),
      releasedQty: '0',
      status: 'reserved',
    });
    totalReserved += take;
    remaining -= take;
  }

  return { reservedQty: totalReserved, backorderQty: Math.max(0, neededQty - totalReserved) };
}

/** Releases all active reservations for an SO (on cancel). */
export async function releaseAllReservations(tdb: TenantDb, soId: string) {
  await tdb
    .update(stockReservations)
    .set({ status: 'released', releasedQty: stockReservations.reservedQty })
    .where(
      and(
        eq(stockReservations.soId, soId),
        inArray(stockReservations.status, ['reserved', 'partially_released']),
      ),
    );
}
