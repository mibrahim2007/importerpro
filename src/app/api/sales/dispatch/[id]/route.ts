import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import {
  dispatchChallans, dispatchChallanLines,
  salesOrders, salesOrderLines, stockReservations, stockLedger,
  customers, products,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[dc], lines] = await Promise.all([
    tdb.select({
      id: dispatchChallans.id, dcNo: dispatchChallans.dcNo, dcDate: dispatchChallans.dcDate,
      status: dispatchChallans.status, soId: dispatchChallans.soId,
      vehicleNo: dispatchChallans.vehicleNo, driverName: dispatchChallans.driverName,
      driverCnic: dispatchChallans.driverCnic, transportCompany: dispatchChallans.transportCompany,
      freightResponsibility: dispatchChallans.freightResponsibility,
      freightChargesPkr: dispatchChallans.freightChargesPkr,
      gatePassNo: dispatchChallans.gatePassNo, gateOutTime: dispatchChallans.gateOutTime,
      estimatedArrivalDate: dispatchChallans.estimatedArrivalDate,
      deliveryConfirmedDate: dispatchChallans.deliveryConfirmedDate,
      warehouseId: dispatchChallans.warehouseId,
      notes: dispatchChallans.notes, createdAt: dispatchChallans.createdAt,
      customerId: dispatchChallans.customerId,
      soNo: salesOrders.soNo,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerBillingAddress: customers.billingAddress,
    })
    .from(dispatchChallans)
    .leftJoin(salesOrders, eq(salesOrders.id, dispatchChallans.soId))
    .leftJoin(customers, eq(customers.id, dispatchChallans.customerId))
    .where(eq(dispatchChallans.id, id)).limit(1),

    tdb.select({
      id: dispatchChallanLines.id, soLineId: dispatchChallanLines.soLineId,
      productId: dispatchChallanLines.productId, lotBatchNo: dispatchChallanLines.lotBatchNo,
      expiryDate: dispatchChallanLines.expiryDate, dispatchedQty: dispatchChallanLines.dispatchedQty,
      uom: dispatchChallanLines.uom, grossWeightKg: dispatchChallanLines.grossWeightKg,
      netWeightKg: dispatchChallanLines.netWeightKg, packageCount: dispatchChallanLines.packageCount,
      packageType: dispatchChallanLines.packageType, weighmentSlipNo: dispatchChallanLines.weighmentSlipNo,
      qualityCertNo: dispatchChallanLines.qualityCertNo, sortOrder: dispatchChallanLines.sortOrder,
      productName: products.name, productCode: products.code,
    })
    .from(dispatchChallanLines)
    .leftJoin(products, eq(products.id, dispatchChallanLines.productId))
    .where(eq(dispatchChallanLines.dcId, id))
    .orderBy(dispatchChallanLines.sortOrder),
  ]);

  if (!dc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ dc, lines });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[dc]] = await Promise.all([
    tdb.select({ status: dispatchChallans.status, soId: dispatchChallans.soId, warehouseId: dispatchChallans.warehouseId })
      .from(dispatchChallans).where(eq(dispatchChallans.id, id)).limit(1),
  ]);
  if (!dc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action } = body;

  // ── Approve ───────────────────────────────────────────────────────────────
  if (action === 'approve') {
    if (dc.status !== 'draft') return NextResponse.json({ error: 'Only draft DCs can be approved' }, { status: 422 });
    await tdb.update(dispatchChallans).set({ status: 'approved', updatedAt: new Date() }).where(eq(dispatchChallans.id, id));
    return NextResponse.json({ ok: true });
  }

  // ── Issue Gate Pass ───────────────────────────────────────────────────────
  if (action === 'issue_gate_pass') {
    if (dc.status !== 'approved') return NextResponse.json({ error: 'Must be approved first' }, { status: 422 });
    const dcFull = await tdb.select().from(dispatchChallans).where(eq(dispatchChallans.id, id)).limit(1);
    const gatePassNo = body.gatePassNo || `GP-${dcFull[0].dcNo.replace('DC-', '')}`;
    await tdb.update(dispatchChallans).set({
      status: 'gate_pass_issued', gatePassNo, updatedAt: new Date(),
    }).where(eq(dispatchChallans.id, id));
    return NextResponse.json({ ok: true, gatePassNo });
  }

  // ── Gate Out / In Transit ─────────────────────────────────────────────────
  if (action === 'gate_out') {
    if (dc.status !== 'gate_pass_issued') return NextResponse.json({ error: 'Gate pass must be issued first' }, { status: 422 });
    await tdb.update(dispatchChallans).set({
      status: 'in_transit', gateOutTime: new Date(), updatedAt: new Date(),
    }).where(eq(dispatchChallans.id, id));
    return NextResponse.json({ ok: true });
  }

  // ── Mark Delivered ────────────────────────────────────────────────────────
  if (action === 'deliver') {
    if (dc.status !== 'in_transit') return NextResponse.json({ error: 'Must be in transit first' }, { status: 422 });

    const dcLines = await tdb.select().from(dispatchChallanLines).where(eq(dispatchChallanLines.dcId, id));

    // 1. Post stock ledger sale_out entries
    await tdb.insert(stockLedger).values(
      dcLines.map((l) => ({
        productId: l.productId,
        warehouseId: dc.warehouseId!,
        movementType: 'sale_out' as const,
        referenceType: 'dispatch_challan',
        referenceId: id,
        referenceLineId: l.id,
        qty: String(-parseFloat(l.dispatchedQty)),  // negative = out
        uom: l.uom,
        lotBatchNo: l.lotBatchNo,
        expiryDate: l.expiryDate,
        notes: `DC ${body.dcNo ?? id}`,
        createdById: session.user.id,
      }))
    );

    // 2. Update SO line dispatched qty and release reservations
    for (const l of dcLines) {
      const dispQty = parseFloat(l.dispatchedQty);
      await tdb.update(salesOrderLines).set({
        dispatchedQty: sql`${salesOrderLines.dispatchedQty}::numeric + ${dispQty}`,
      }).where(eq(salesOrderLines.id, l.soLineId));

      // Release reservation for this lot on this SO line
      if (l.lotBatchNo) {
        const [res] = await tdb.select().from(stockReservations).where(
          and(
            eq(stockReservations.soLineId, l.soLineId),
            eq(stockReservations.lotBatchNo, l.lotBatchNo),
          )
        ).limit(1);
        if (res) {
          const newReleased = parseFloat(res.releasedQty ?? '0') + dispQty;
          const reserved = parseFloat(res.reservedQty);
          await tdb.update(stockReservations).set({
            releasedQty: String(newReleased),
            status: newReleased >= reserved ? 'released' : 'partially_released',
          }).where(eq(stockReservations.id, res.id));
        }
      }
    }

    // 3. Recalculate SO status
    const soLines = await tdb.select({ orderedQty: salesOrderLines.orderedQty, dispatchedQty: salesOrderLines.dispatchedQty })
      .from(salesOrderLines).where(eq(salesOrderLines.soId, dc.soId));
    const allDispatched = soLines.every(
      (l) => parseFloat(l.dispatchedQty ?? '0') >= parseFloat(l.orderedQty)
    );
    await tdb.update(salesOrders).set({
      status: allDispatched ? 'fully_dispatched' : 'partially_dispatched',
      updatedAt: new Date(),
    }).where(eq(salesOrders.id, dc.soId));

    const deliveryDate = body.deliveryConfirmedDate || new Date().toISOString().split('T')[0];
    await tdb.update(dispatchChallans).set({
      status: 'delivered', deliveryConfirmedDate: deliveryDate, updatedAt: new Date(),
    }).where(eq(dispatchChallans.id, id));

    return NextResponse.json({ ok: true, soStatus: allDispatched ? 'fully_dispatched' : 'partially_dispatched' });
  }

  // ── Field update ──────────────────────────────────────────────────────────
  const allowed = ['vehicleNo', 'driverName', 'driverCnic', 'transportCompany', 'estimatedArrivalDate', 'notes'];
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k] || null;
  await tdb.update(dispatchChallans).set(update).where(eq(dispatchChallans.id, id));
  return NextResponse.json({ ok: true });
}
