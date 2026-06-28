import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockAdjustments, stockLedger } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const adjustments = await tdb.select().from(stockAdjustments).orderBy(desc(stockAdjustments.createdAt));
  return NextResponse.json({ adjustments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { adjDate, warehouseId, locationId, productId, lotBatchNo, qty, uom, reasonCode, notes } = body;

  if (!warehouseId || !productId) return NextResponse.json({ error: 'Warehouse and product required' }, { status: 400 });
  if (qty === undefined || qty === null || qty === 0) return NextResponse.json({ error: 'Qty must be non-zero' }, { status: 400 });
  if (!reasonCode) return NextResponse.json({ error: 'Reason code required' }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  const year = new Date().getFullYear();
  const count = await tdb.$count(stockAdjustments);
  const adjNo = `ADJ-${year}-${String(count + 1).padStart(4, '0')}`;

  const [adjustment] = await tdb.insert(stockAdjustments).values({
    adjNo,
    adjDate: adjDate ?? new Date().toISOString().split('T')[0],
    warehouseId,
    locationId: locationId || null,
    productId,
    lotBatchNo: lotBatchNo || null,
    qty: String(qty),
    uom: uom || null,
    reasonCode,
    notes: notes || null,
    createdById: session.user.id as any,
  }).returning();

  // Write stock_ledger entry immediately
  await tdb.insert(stockLedger).values({
    productId,
    warehouseId,
    locationId: locationId || null,
    movementType: 'adjustment',
    referenceType: 'stock_adjustment',
    referenceId: adjustment.id,
    qty: String(qty),
    uom: uom || null,
    lotBatchNo: lotBatchNo || null,
    notes: `${reasonCode}: ${notes ?? adjNo}`,
    createdById: session.user.id as any,
  } as any);

  return NextResponse.json({ adjustment }, { status: 201 });
}
