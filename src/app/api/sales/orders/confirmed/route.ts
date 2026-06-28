import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import {
  salesOrders, salesOrderLines, stockReservations,
  customers, products,
} from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

/** Returns confirmed / partially_dispatched SOs with their remaining (unreleased) reserved lines. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const orders = await tdb
    .select({
      id: salesOrders.id, soNo: salesOrders.soNo, soDate: salesOrders.soDate,
      status: salesOrders.status, warehouseId: salesOrders.warehouseId,
      customerId: salesOrders.customerId,
      customerName: customers.name, customerCode: customers.code,
    })
    .from(salesOrders)
    .leftJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(inArray(salesOrders.status, ['confirmed', 'partially_dispatched']));

  if (!orders.length) return NextResponse.json([]);

  const soIds = orders.map((o) => o.id);

  const [lines, reservations] = await Promise.all([
    tdb.select({
      id: salesOrderLines.id, soId: salesOrderLines.soId,
      productId: salesOrderLines.productId,
      orderedQty: salesOrderLines.orderedQty, uom: salesOrderLines.uom,
      reservedQty: salesOrderLines.reservedQty, dispatchedQty: salesOrderLines.dispatchedQty,
      productName: products.name, productCode: products.code,
    })
    .from(salesOrderLines)
    .leftJoin(products, eq(products.id, salesOrderLines.productId))
    .where(inArray(salesOrderLines.soId, soIds)),

    tdb.select({
      soId: stockReservations.soId, soLineId: stockReservations.soLineId,
      productId: stockReservations.productId, lotBatchNo: stockReservations.lotBatchNo,
      expiryDate: stockReservations.expiryDate,
      reservedQty: stockReservations.reservedQty, releasedQty: stockReservations.releasedQty,
      status: stockReservations.status,
    })
    .from(stockReservations)
    .where(
      and(
        inArray(stockReservations.soId, soIds),
        inArray(stockReservations.status, ['reserved', 'partially_released']),
      )
    ),
  ]);

  const result = orders.map((o) => {
    const soLines = lines.filter((l) => l.soId === o.id);
    return {
      ...o,
      lines: soLines.map((l) => {
        const lots = reservations.filter((r) => r.soLineId === l.id);
        const remainingReserved = lots.reduce(
          (s, r) => s + parseFloat(r.reservedQty) - parseFloat(r.releasedQty ?? '0'), 0
        );
        return { ...l, remainingReserved, lots };
      }).filter((l) => l.remainingReserved > 0),
    };
  }).filter((o) => o.lines.length > 0);

  return NextResponse.json(result);
}
