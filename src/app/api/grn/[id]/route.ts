import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { grns, grnLines, stockLedger, shipments, goodsDeclarations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [[grn], lines] = await Promise.all([
    tdb.select().from(grns).where(eq(grns.id, id)).limit(1),
    tdb.select().from(grnLines).where(eq(grnLines.grnId, id)).orderBy(grnLines.sortOrder),
  ]);
  if (!grn) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...grn, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();

  const [[grn], lines] = await Promise.all([
    tdb.select().from(grns).where(eq(grns.id, id)).limit(1),
    tdb.select().from(grnLines).where(eq(grnLines.grnId, id)),
  ]);
  if (!grn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action, ...fields } = body;

  if (action === 'post') {
    if (grn.status !== 'draft') return NextResponse.json({ error: 'GRN is not in draft' }, { status: 422 });
    if (lines.length === 0) return NextResponse.json({ error: 'No lines to post' }, { status: 422 });

    const now = new Date();
    const hasQcHold = lines.some((l) => l.qualityStatus === 'under_qc');
    const newStatus = hasQcHold ? 'qc_hold' : 'posted';

    // Write stock ledger entries for accepted lines
    const acceptedLines = lines.filter((l) => l.qualityStatus === 'accepted');
    if (acceptedLines.length > 0) {
      await tdb.insert(stockLedger).values(
        acceptedLines.map((l) => ({
          productId: l.productId,
          warehouseId: grn.warehouseId,
          locationId: l.storageLocationId || grn.receivingLocationId || null,
          movementType: 'grn_in',
          referenceType: 'grn',
          referenceId: grn.id,
          referenceLineId: l.id,
          qty: l.receivedQty,
          uom: l.uom ?? null,
          lotBatchNo: l.lotBatchNo ?? null,
          expiryDate: l.expiryDate ?? null,
          notes: `GRN ${grn.grnNo}`,
          createdById: session.user.id,
        }))
      );
    }

    // Stock ledger entries for QC hold lines — to a quarantine bucket
    const qcLines = lines.filter((l) => l.qualityStatus === 'under_qc');
    if (qcLines.length > 0) {
      await tdb.insert(stockLedger).values(
        qcLines.map((l) => ({
          productId: l.productId,
          warehouseId: grn.warehouseId,
          locationId: l.storageLocationId || null,
          movementType: 'qc_hold',
          referenceType: 'grn',
          referenceId: grn.id,
          referenceLineId: l.id,
          qty: l.receivedQty,
          uom: l.uom ?? null,
          lotBatchNo: l.lotBatchNo ?? null,
          notes: `QC Hold — GRN ${grn.grnNo}`,
          createdById: session.user.id,
        }))
      );
    }

    // Sync linked shipment → grn_done and GD → cleared (if not already)
    if (grn.shipmentId) {
      await tdb.update(shipments).set({ status: 'grn_done', updatedAt: now })
        .where(eq(shipments.id, grn.shipmentId));
    }
    if (grn.gdId) {
      const [gd] = await tdb.select({ status: goodsDeclarations.status })
        .from(goodsDeclarations).where(eq(goodsDeclarations.id, grn.gdId)).limit(1);
      if (gd && gd.status !== 'cleared') {
        await tdb.update(goodsDeclarations)
          .set({ status: 'cleared', gdClearedDate: now.toISOString().split('T')[0], updatedAt: now })
          .where(eq(goodsDeclarations.id, grn.gdId));
      }
    }

    const [updated] = await tdb.update(grns)
      .set({ status: newStatus as any, postedAt: now, updatedAt: now })
      .where(eq(grns.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'qc_release') {
    if (grn.status !== 'qc_hold') return NextResponse.json({ error: 'GRN is not in QC hold' }, { status: 422 });
    const now = new Date();

    // Update QC hold lines to accepted and write release entries
    const qcLines = lines.filter((l) => l.qualityStatus === 'under_qc');
    const { lineDecisions }: { lineDecisions?: Record<string, 'accepted' | 'rejected'> } = fields;

    for (const l of qcLines) {
      const decision = lineDecisions?.[l.id] ?? 'accepted';
      await tdb.update(grnLines).set({
        qualityStatus: decision,
        acceptedQty: decision === 'accepted' ? l.receivedQty : null,
        rejectedQty: decision === 'rejected' ? l.receivedQty : null,
      }).where(eq(grnLines.id, l.id));

      // Write stock movement: release from qc_hold → available OR rejection
      await tdb.insert(stockLedger).values({
        productId: l.productId,
        warehouseId: grn.warehouseId,
        locationId: l.storageLocationId || null,
        movementType: decision === 'accepted' ? 'qc_release' : 'rejection',
        referenceType: 'grn',
        referenceId: grn.id,
        referenceLineId: l.id,
        qty: decision === 'accepted' ? l.receivedQty : `-${l.receivedQty}`,
        uom: l.uom ?? null,
        lotBatchNo: l.lotBatchNo ?? null,
        notes: decision === 'accepted' ? `QC Released — GRN ${grn.grnNo}` : `Rejected — GRN ${grn.grnNo}`,
        createdById: session.user.id,
      });
    }

    const [updated] = await tdb.update(grns)
      .set({ status: 'qc_released', qcReleasedAt: now, updatedAt: now })
      .where(eq(grns.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    if (grn.status !== 'draft') return NextResponse.json({ error: 'Can only cancel draft GRNs' }, { status: 422 });
    const [updated] = await tdb.update(grns)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(grns.id, id)).returning();
    return NextResponse.json(updated);
  }

  // Line QC update (individual line quality status before posting)
  if (fields.lineId && fields.qualityStatus) {
    await tdb.update(grnLines).set({ qualityStatus: fields.qualityStatus })
      .where(eq(grnLines.id, fields.lineId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
