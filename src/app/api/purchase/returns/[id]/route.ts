import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  purchaseReturnAuthorizations, praLines,
  suppliers, purchaseOrders, grns, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [pra] = await tdb
    .select({
      id: purchaseReturnAuthorizations.id,
      praNo: purchaseReturnAuthorizations.praNo,
      praDate: purchaseReturnAuthorizations.praDate,
      supplierId: purchaseReturnAuthorizations.supplierId,
      poId: purchaseReturnAuthorizations.poId,
      grnId: purchaseReturnAuthorizations.grnId,
      returnReason: purchaseReturnAuthorizations.returnReason,
      description: purchaseReturnAuthorizations.description,
      expectedDispatchDate: purchaseReturnAuthorizations.expectedDispatchDate,
      returnMode: purchaseReturnAuthorizations.returnMode,
      status: purchaseReturnAuthorizations.status,
      approvedAt: purchaseReturnAuthorizations.approvedAt,
      dispatchedAt: purchaseReturnAuthorizations.dispatchedAt,
      vehicleNo: purchaseReturnAuthorizations.vehicleNo,
      transportCompany: purchaseReturnAuthorizations.transportCompany,
      cancelledReason: purchaseReturnAuthorizations.cancelledReason,
      debitNoteId: purchaseReturnAuthorizations.debitNoteId,
      notes: purchaseReturnAuthorizations.notes,
      createdAt: purchaseReturnAuthorizations.createdAt,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      poNo: purchaseOrders.poNo,
      grnNo: grns.grnNo,
    })
    .from(purchaseReturnAuthorizations)
    .leftJoin(suppliers, eq(suppliers.id, purchaseReturnAuthorizations.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, purchaseReturnAuthorizations.poId))
    .leftJoin(grns, eq(grns.id, purchaseReturnAuthorizations.grnId))
    .where(eq(purchaseReturnAuthorizations.id, id));

  if (!pra) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await tdb
    .select({
      id: praLines.id,
      grnLineId: praLines.grnLineId,
      productId: praLines.productId,
      hsCode: praLines.hsCode,
      description: praLines.description,
      returnQty: praLines.returnQty,
      dispatchedQty: praLines.dispatchedQty,
      uom: praLines.uom,
      unitPrice: praLines.unitPrice,
      currency: praLines.currency,
      lotNo: praLines.lotNo,
      sortOrder: praLines.sortOrder,
      productName: products.name,
    })
    .from(praLines)
    .leftJoin(products, eq(products.id, praLines.productId))
    .where(eq(praLines.praId, id))
    .orderBy(praLines.sortOrder);

  return NextResponse.json({ ...pra, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { action } = body;

  const [current] = await tdb
    .select({ status: purchaseReturnAuthorizations.status })
    .from(purchaseReturnAuthorizations)
    .where(eq(purchaseReturnAuthorizations.id, id));

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'approve') {
    if (current.status !== 'draft') return NextResponse.json({ error: 'Can only approve draft PRAs' }, { status: 400 });
    const [updated] = await tdb
      .update(purchaseReturnAuthorizations)
      .set({ status: 'approved', approvedById: session.user.id, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(purchaseReturnAuthorizations.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    if (['debit_issued', 'closed', 'cancelled'].includes(current.status ?? '')) {
      return NextResponse.json({ error: `Cannot cancel PRA in ${current.status} status` }, { status: 400 });
    }
    const [updated] = await tdb
      .update(purchaseReturnAuthorizations)
      .set({ status: 'cancelled', cancelledReason: body.reason || null, updatedAt: new Date() })
      .where(eq(purchaseReturnAuthorizations.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'set_debit_note') {
    const [updated] = await tdb
      .update(purchaseReturnAuthorizations)
      .set({ debitNoteId: body.debitNoteId, status: 'debit_issued', updatedAt: new Date() })
      .where(eq(purchaseReturnAuthorizations.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'close') {
    const [updated] = await tdb
      .update(purchaseReturnAuthorizations)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(purchaseReturnAuthorizations.id, id)).returning();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
