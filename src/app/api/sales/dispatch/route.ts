import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { dispatchChallans, dispatchChallanLines, salesOrders, customers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: dispatchChallans.id, dcNo: dispatchChallans.dcNo, dcDate: dispatchChallans.dcDate,
      status: dispatchChallans.status, freightResponsibility: dispatchChallans.freightResponsibility,
      vehicleNo: dispatchChallans.vehicleNo, gatePassNo: dispatchChallans.gatePassNo,
      gateOutTime: dispatchChallans.gateOutTime,
      deliveryConfirmedDate: dispatchChallans.deliveryConfirmedDate,
      estimatedArrivalDate: dispatchChallans.estimatedArrivalDate,
      createdAt: dispatchChallans.createdAt,
      soNo: salesOrders.soNo, customerId: dispatchChallans.customerId,
      customerName: customers.name,
    })
    .from(dispatchChallans)
    .leftJoin(salesOrders, eq(salesOrders.id, dispatchChallans.soId))
    .leftJoin(customers, eq(customers.id, dispatchChallans.customerId))
    .orderBy(desc(dispatchChallans.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const count = await tdb.$count(dispatchChallans);
  const year = new Date().getFullYear();
  const dcNo = `DC-${year}-${String(count + 1).padStart(4, '0')}`;

  const [dc] = await tdb.insert(dispatchChallans).values({
    dcNo, dcDate: body.dcDate, soId: body.soId, customerId: body.customerId,
    deliveryAddressId: body.deliveryAddressId || null,
    warehouseId: body.warehouseId || null,
    vehicleNo: body.vehicleNo || null, driverName: body.driverName || null,
    driverCnic: body.driverCnic || null, transportCompany: body.transportCompany || null,
    freightResponsibility: body.freightResponsibility || 'ex_works',
    freightChargesPkr: body.freightChargesPkr || '0',
    estimatedArrivalDate: body.estimatedArrivalDate || null,
    notes: body.notes || null, status: 'draft',
    createdById: session.user.id,
  }).returning();

  if (body.lines?.length) {
    await tdb.insert(dispatchChallanLines).values(
      body.lines.map((l: any, i: number) => ({
        dcId: dc.id, soLineId: l.soLineId, productId: l.productId,
        lotBatchNo: l.lotBatchNo || null, expiryDate: l.expiryDate || null,
        dispatchedQty: String(l.dispatchedQty), uom: l.uom || null,
        grossWeightKg: l.grossWeightKg || null, netWeightKg: l.netWeightKg || null,
        packageCount: l.packageCount ? parseInt(l.packageCount) : null,
        packageType: l.packageType || null,
        weighmentSlipNo: l.weighmentSlipNo || null, qualityCertNo: l.qualityCertNo || null,
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(dc, { status: 201 });
}
