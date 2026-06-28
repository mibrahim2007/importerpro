import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockTransfers, stockTransferLines, stockLedger } from '@/db/schema';
import { eq } from 'drizzle-orm';

const ALLOWED_FROM: Record<string, string[]> = {
  validate: ['draft'],
  complete:  ['validated'],
  cancel:    ['draft', 'validated'],
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[transfer], lines] = await Promise.all([
    tdb.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1),
    tdb.select().from(stockTransferLines).where(eq(stockTransferLines.transferId, id)),
  ]);

  if (!transfer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ transfer, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[transfer], lines] = await Promise.all([
    tdb.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1),
    tdb.select().from(stockTransferLines).where(eq(stockTransferLines.transferId, id)),
  ]);

  if (!transfer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = ALLOWED_FROM[action] ?? [];
  if (!allowed.includes(transfer.status ?? 'draft'))
    return NextResponse.json({ error: `Cannot ${action} from status ${transfer.status}` }, { status: 422 });

  const now = new Date();

  if (action === 'validate') {
    await tdb.update(stockTransfers).set({ status: 'validated', validatedAt: now, updatedAt: now }).where(eq(stockTransfers.id, id));
  }

  if (action === 'complete') {
    // Write stock_ledger: transfer_out from source, transfer_in at destination
    const ledgerEntries = lines.flatMap((l) => [
      {
        productId: l.productId,
        warehouseId: transfer.fromWarehouseId,
        locationId: transfer.fromLocationId ?? null,
        movementType: 'transfer_out' as const,
        referenceType: 'stock_transfer',
        referenceId: transfer.id,
        referenceLineId: l.id,
        qty: String(-Math.abs(parseFloat(l.requestedQty))),
        uom: l.uom ?? null,
        lotBatchNo: l.lotBatchNo ?? null,
        notes: `Transfer out: ${transfer.transferNo}`,
        createdById: session.user.id as any,
      },
      {
        productId: l.productId,
        warehouseId: transfer.toWarehouseId,
        locationId: transfer.toLocationId ?? null,
        movementType: 'transfer_in' as const,
        referenceType: 'stock_transfer',
        referenceId: transfer.id,
        referenceLineId: l.id,
        qty: String(Math.abs(parseFloat(l.requestedQty))),
        uom: l.uom ?? null,
        lotBatchNo: l.lotBatchNo ?? null,
        notes: `Transfer in: ${transfer.transferNo}`,
        createdById: session.user.id as any,
      },
    ]);

    if (ledgerEntries.length > 0) await tdb.insert(stockLedger).values(ledgerEntries as any);

    // Update done_qty on lines
    for (const l of lines) {
      await tdb.update(stockTransferLines).set({ doneQty: l.requestedQty }).where(eq(stockTransferLines.id, l.id));
    }

    await tdb.update(stockTransfers).set({ status: 'done', doneAt: now, updatedAt: now }).where(eq(stockTransfers.id, id));
  }

  if (action === 'cancel') {
    await tdb.update(stockTransfers).set({ status: 'cancelled', updatedAt: now }).where(eq(stockTransfers.id, id));
  }

  const [[updated]] = await Promise.all([
    tdb.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1),
  ]);
  return NextResponse.json({ transfer: updated });
}
