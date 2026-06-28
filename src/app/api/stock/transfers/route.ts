import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockTransfers, stockTransferLines } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const transfers = await tdb.select().from(stockTransfers).orderBy(desc(stockTransfers.createdAt));
  return NextResponse.json({ transfers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { transferDate, fromWarehouseId, fromLocationId, toWarehouseId, toLocationId, reason, notes, lines } = body;

  if (!fromWarehouseId || !toWarehouseId) return NextResponse.json({ error: 'Source and destination warehouses required' }, { status: 400 });
  if (fromWarehouseId === toWarehouseId && fromLocationId === toLocationId)
    return NextResponse.json({ error: 'Source and destination must differ' }, { status: 400 });
  if (!lines?.length) return NextResponse.json({ error: 'At least one line required' }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  const year = new Date().getFullYear();
  const count = await tdb.$count(stockTransfers);
  const transferNo = `TRF-${year}-${String(count + 1).padStart(4, '0')}`;

  const [transfer] = await tdb.insert(stockTransfers).values({
    transferNo,
    transferDate: transferDate ?? new Date().toISOString().split('T')[0],
    fromWarehouseId,
    fromLocationId: fromLocationId || null,
    toWarehouseId,
    toLocationId: toLocationId || null,
    reason: reason || null,
    notes: notes || null,
    status: 'draft',
    createdById: session.user.id as any,
  }).returning();

  await tdb.insert(stockTransferLines).values(
    lines.map((l: any, i: number) => ({
      transferId: transfer.id,
      productId: l.productId,
      lotBatchNo: l.lotBatchNo || null,
      requestedQty: String(l.requestedQty),
      uom: l.uom || null,
      sortOrder: i,
    }))
  );

  return NextResponse.json({ transfer }, { status: 201 });
}
