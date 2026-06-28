import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import {
  salesOrders, salesOrderLines, stockReservations,
  customers, customerAddresses, products, warehouses, salesInvoices,
} from '@/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { reserveStock, releaseAllReservations } from '@/lib/sales/stock-reservation';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[so], lines, reservations] = await Promise.all([
    tdb.select({
      id: salesOrders.id, soNo: salesOrders.soNo, soDate: salesOrders.soDate,
      status: salesOrders.status, creditCheck: salesOrders.creditCheck,
      paymentTerms: salesOrders.paymentTerms,
      requestedDeliveryDate: salesOrders.requestedDeliveryDate,
      promisedDeliveryDate: salesOrders.promisedDeliveryDate,
      internalNotes: salesOrders.internalNotes,
      subtotalPkr: salesOrders.subtotalPkr, salesTaxPkr: salesOrders.salesTaxPkr,
      whtPkr: salesOrders.whtPkr, grandTotalPkr: salesOrders.grandTotalPkr,
      outstandingBalancePkr: salesOrders.outstandingBalancePkr,
      creditLimitPkr: salesOrders.creditLimitPkr,
      approvedAt: salesOrders.approvedAt, approvalNote: salesOrders.approvalNote,
      cancellationReason: salesOrders.cancellationReason,
      quotationId: salesOrders.quotationId, createdAt: salesOrders.createdAt,
      customerId: salesOrders.customerId, warehouseId: salesOrders.warehouseId,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerStrn: customers.strn,
      customerPhone: customers.phone, whtRatePct: customers.whtRatePct,
      customerBillingAddress: customers.billingAddress,
    })
    .from(salesOrders)
    .leftJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(eq(salesOrders.id, id)).limit(1),

    tdb.select({
      id: salesOrderLines.id, productId: salesOrderLines.productId,
      orderedQty: salesOrderLines.orderedQty, uom: salesOrderLines.uom,
      unitPricePkr: salesOrderLines.unitPricePkr, discountPct: salesOrderLines.discountPct,
      netUnitPricePkr: salesOrderLines.netUnitPricePkr,
      totalPkr: salesOrderLines.totalPkr,
      salesTaxPct: salesOrderLines.salesTaxPct, salesTaxPkr: salesOrderLines.salesTaxPkr,
      reservedQty: salesOrderLines.reservedQty, dispatchedQty: salesOrderLines.dispatchedQty,
      backorderQty: salesOrderLines.backorderQty, sortOrder: salesOrderLines.sortOrder,
      productName: products.name, productCode: products.code,
    })
    .from(salesOrderLines)
    .leftJoin(products, eq(products.id, salesOrderLines.productId))
    .where(eq(salesOrderLines.soId, id))
    .orderBy(salesOrderLines.sortOrder),

    tdb.select({
      id: stockReservations.id, soLineId: stockReservations.soLineId,
      lotBatchNo: stockReservations.lotBatchNo, expiryDate: stockReservations.expiryDate,
      reservedQty: stockReservations.reservedQty, releasedQty: stockReservations.releasedQty,
      status: stockReservations.status, productId: stockReservations.productId,
    })
    .from(stockReservations)
    .where(eq(stockReservations.soId, id)),
  ]);

  if (!so) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ so, lines, reservations });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[current]] = await Promise.all([
    tdb.select({
      status: salesOrders.status, customerId: salesOrders.customerId,
      grandTotalPkr: salesOrders.grandTotalPkr, creditLimitPkr: salesOrders.creditLimitPkr,
      warehouseId: salesOrders.warehouseId,
    })
    .from(salesOrders).where(eq(salesOrders.id, id)).limit(1),
  ]);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action } = body;

  // ── Confirm ────────────────────────────────────────────────────────────────
  if (action === 'confirm') {
    if (!['draft', 'pending_approval'].includes(current.status ?? ''))
      return NextResponse.json({ error: 'Cannot confirm from current status' }, { status: 422 });

    // Credit check: sum balance_pkr from unpaid sales invoices for this customer
    const [{ outstandingSum }] = await tdb.select({
      outstandingSum: sql<string>`COALESCE(SUM(balance_pkr), 0)`,
    }).from(salesInvoices).where(
      and(
        eq(salesInvoices.customerId, current.customerId),
        sql`status NOT IN ('draft','cancelled','fully_paid')`,
      )
    );
    const outstanding = parseFloat(outstandingSum ?? '0');
    const soValue = parseFloat(current.grandTotalPkr ?? '0');
    const creditLimit = parseFloat(current.creditLimitPkr ?? '0');
    const creditPass = creditLimit === 0 || (outstanding + soValue) <= creditLimit;
    const creditStatus: 'pass' | 'fail' = creditPass ? 'pass' : 'fail';

    if (!creditPass && body.force !== true) {
      // Move to credit hold, let Finance approve
      await tdb.update(salesOrders).set({
        status: 'pending_approval', creditCheck: 'fail',
        outstandingBalancePkr: String(outstanding),
        updatedAt: new Date(),
      }).where(eq(salesOrders.id, id));
      return NextResponse.json({ creditHold: true, outstanding, soValue, creditLimit });
    }

    // Reserve stock per line (FEFO)
    const lines = await tdb.select().from(salesOrderLines).where(eq(salesOrderLines.soId, id));
    const warehouseId = current.warehouseId;

    for (const line of lines) {
      const needed = parseFloat(line.orderedQty);
      let reservedQty = 0, backorderQty = 0;

      if (warehouseId) {
        const result = await reserveStock(tdb, id, line.id, line.productId, warehouseId, needed);
        reservedQty = result.reservedQty;
        backorderQty = result.backorderQty;
      } else {
        backorderQty = needed;
      }

      await tdb.update(salesOrderLines).set({
        reservedQty: String(reservedQty.toFixed(3)),
        backorderQty: String(backorderQty.toFixed(3)),
      }).where(eq(salesOrderLines.id, line.id));
    }

    await tdb.update(salesOrders).set({
      status: 'confirmed',
      creditCheck: body.force ? 'override' : creditStatus,
      outstandingBalancePkr: String(outstanding),
      approvedById: body.force ? session.user.id : null,
      approvedAt: body.force ? new Date() : null,
      approvalNote: body.force ? (body.approvalNote || null) : null,
      updatedAt: new Date(),
    }).where(eq(salesOrders.id, id));

    return NextResponse.json({ ok: true, creditCheck: body.force ? 'override' : creditStatus });
  }

  // ── Approve credit hold ───────────────────────────────────────────────────
  if (action === 'approve_credit') {
    if (current.status !== 'pending_approval')
      return NextResponse.json({ error: 'Not in pending_approval state' }, { status: 422 });

    return PATCH(
      new Request(req.url, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'confirm', force: true, approvalNote: body.approvalNote }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params },
    );
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    if (['invoiced', 'closed'].includes(current.status ?? ''))
      return NextResponse.json({ error: 'Cannot cancel invoiced or closed SO' }, { status: 422 });
    await releaseAllReservations(tdb, id);
    await tdb.update(salesOrders).set({
      status: 'cancelled',
      cancellationReason: body.reason || null,
      updatedAt: new Date(),
    }).where(eq(salesOrders.id, id));
    return NextResponse.json({ ok: true });
  }

  // ── Field update ──────────────────────────────────────────────────────────
  const allowed = ['internalNotes', 'promisedDeliveryDate', 'requestedDeliveryDate'];
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k] || null;
  await tdb.update(salesOrders).set(update).where(eq(salesOrders.id, id));
  return NextResponse.json({ ok: true });
}
