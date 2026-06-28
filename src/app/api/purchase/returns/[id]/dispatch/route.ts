import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  purchaseReturnAuthorizations, praLines, stockLedger,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: praId } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [pra] = await tdb
    .select({ status: purchaseReturnAuthorizations.status })
    .from(purchaseReturnAuthorizations)
    .where(eq(purchaseReturnAuthorizations.id, praId));

  if (!pra) return NextResponse.json({ error: 'PRA not found' }, { status: 404 });
  if (pra.status !== 'approved') {
    return NextResponse.json({ error: 'PRA must be approved before dispatching' }, { status: 400 });
  }

  const body = await req.json();
  const { lines = [], dispatchDate, vehicleNo, transportCompany } = body;

  // Update PRA with dispatch info + status
  await tdb
    .update(purchaseReturnAuthorizations)
    .set({
      status: 'goods_dispatched',
      dispatchedAt: new Date(),
      vehicleNo: vehicleNo || null,
      transportCompany: transportCompany || null,
      updatedAt: new Date(),
    })
    .where(eq(purchaseReturnAuthorizations.id, praId));

  // Write stock ledger entries (negative — removing from our stock)
  const ledgerEntries: any[] = [];
  for (const l of lines) {
    const dispatchedQty = parseFloat(String(l.dispatchedQty ?? 0));
    if (!l.productId || !l.warehouseId || dispatchedQty <= 0) continue;

    // Update dispatched qty on PRA line
    if (l.praLineId) {
      await tdb
        .update(praLines)
        .set({ dispatchedQty: String(dispatchedQty) })
        .where(eq(praLines.id, l.praLineId));
    }

    ledgerEntries.push({
      productId: l.productId,
      warehouseId: l.warehouseId,
      locationId: l.locationId || null,
      movementType: 'purchase_return_out',
      qty: String(-dispatchedQty),              // negative — stock out
      lotBatchNo: l.lotNo || null,
      referenceType: 'purchase_return',
      referenceId: praId,
      notes: `${body.praNo ?? ''} dispatch`,
      createdById: session.user.id,
    });
  }

  if (ledgerEntries.length > 0) {
    await tdb.insert(stockLedger).values(ledgerEntries);
  }

  return NextResponse.json({ ok: true, dispatchedLines: lines.length }, { status: 200 });
}
