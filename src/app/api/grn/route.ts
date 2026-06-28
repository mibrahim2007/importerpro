import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { grns, grnLines, purchaseOrders, poLines } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(grns).orderBy(desc(grns.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();

  const count = await tdb.$count(grns);
  const year = new Date().getFullYear();
  const grnNo = `GRN-${year}-${String(count + 1).padStart(4, '0')}`;

  const [grn] = await tdb.insert(grns).values({
    grnNo,
    grnDate: body.grnDate,
    shipmentId: body.shipmentId || null,
    gdId: body.gdId || null,
    poId: body.poId || null,
    warehouseId: body.warehouseId,
    receivingLocationId: body.receivingLocationId || null,
    vehicleNo: body.vehicleNo || null,
    driverName: body.driverName || null,
    deliveryChallanNo: body.deliveryChallanNo || null,
    notes: body.notes || null,
    createdById: session.user.id,
  }).returning();

  if ((body.lines ?? []).length > 0) {
    await tdb.insert(grnLines).values(
      body.lines.map((l: any, i: number) => ({
        grnId: grn.id,
        productId: l.productId,
        hsCode: l.hsCode || null,
        orderedQty: l.orderedQty ? String(l.orderedQty) : null,
        receivedQty: String(l.receivedQty),
        acceptedQty: l.qualityStatus === 'accepted' ? String(l.receivedQty) : null,
        rejectedQty: l.qualityStatus === 'rejected' ? String(l.receivedQty) : null,
        uom: l.uom || null,
        lotBatchNo: l.lotBatchNo || null,
        expiryDate: l.expiryDate || null,
        storageLocationId: l.storageLocationId || null,
        qualityStatus: l.qualityStatus ?? 'accepted',
        conditionOnReceipt: l.conditionOnReceipt ?? 'good',
        unitWeightKg: l.unitWeightKg ? String(l.unitWeightKg) : null,
        totalWeightKg: l.totalWeightKg ? String(l.totalWeightKg) : null,
        remarks: l.remarks || null,
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(grn, { status: 201 });
}
