import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  returnGrns, returnGrnLines, returnAuthorizations, stockLedger,
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raId } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [ra] = await tdb
    .select({ status: returnAuthorizations.status, customerId: returnAuthorizations.customerId })
    .from(returnAuthorizations)
    .where(eq(returnAuthorizations.id, raId));

  if (!ra) return NextResponse.json({ error: 'RA not found' }, { status: 404 });
  if (ra.status !== 'approved') return NextResponse.json({ error: 'RA must be approved before Return GRN' }, { status: 400 });

  const body = await req.json();
  const { lines = [], ...header } = body;

  // Auto RGRN-YYYY-NNNN
  const year = new Date().getFullYear();
  const [{ count }] = await tdb
    .select({ count: sql<number>`count(*)::int` })
    .from(returnGrns)
    .where(sql`EXTRACT(YEAR FROM created_at) = ${year}`);
  const returnGrnNo = `RGRN-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const [grn] = await tdb.insert(returnGrns).values({
    returnGrnNo,
    raId,
    receivedDate: header.receivedDate,
    warehouseId: header.warehouseId || null,
    locationId: header.locationId || null,
    status: 'posted',
    inspectorNotes: header.inspectorNotes || null,
    createdById: session.user.id,
  }).returning();

  if (lines.length > 0) {
    const grnLines = lines.map((l: any, i: number) => ({
      returnGrnId: grn.id,
      raLineId: l.raLineId || null,
      productId: l.productId || null,
      description: l.description,
      expectedQty: l.expectedQty ? String(l.expectedQty) : null,
      receivedQty: String(l.receivedQty),
      resaleableQty: String(l.resaleableQty ?? 0),
      damagedQty: String(l.damagedQty ?? 0),
      destroyedQty: String(l.destroyedQty ?? 0),
      qualityResult: l.qualityResult ?? 'resaleable',
      qualityNotes: l.qualityNotes || null,
      lotNo: l.lotNo || null,
      uom: l.uom || null,
      sortOrder: i,
    }));

    await tdb.insert(returnGrnLines).values(grnLines);

    // Write stock ledger entries
    const ledgerEntries: any[] = [];
    for (const l of lines) {
      const resaleable = parseFloat(String(l.resaleableQty ?? 0));
      const damaged = parseFloat(String(l.damagedQty ?? 0));
      if (!l.productId) continue;

      const warehouseId = header.warehouseId;
      if (!warehouseId) continue; // skip ledger if no warehouse selected

      if (resaleable > 0) {
        ledgerEntries.push({
          productId: l.productId,
          warehouseId,
          locationId: header.locationId || null,
          movementType: 'return_in',
          qty: String(resaleable),
          lotBatchNo: l.lotNo || null,
          referenceType: 'return_grn',
          referenceId: grn.id,
          notes: returnGrnNo,
          createdById: session.user.id,
        });
      }
      if (damaged > 0) {
        ledgerEntries.push({
          productId: l.productId,
          warehouseId,
          locationId: header.locationId || null,
          movementType: 'return_damaged',
          qty: String(damaged),
          lotBatchNo: l.lotNo || null,
          referenceType: 'return_grn',
          referenceId: grn.id,
          notes: returnGrnNo,
          createdById: session.user.id,
        });
      }
    }

    if (ledgerEntries.length > 0) {
      await tdb.insert(stockLedger).values(ledgerEntries);
    }
  }

  // Update RA status
  await tdb
    .update(returnAuthorizations)
    .set({ status: 'goods_received', updatedAt: new Date() })
    .where(eq(returnAuthorizations.id, raId));

  return NextResponse.json(grn, { status: 201 });
}
