import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  purchaseReturnAuthorizations, praLines, suppliers, purchaseOrders, grns,
} from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: purchaseReturnAuthorizations.id,
      praNo: purchaseReturnAuthorizations.praNo,
      praDate: purchaseReturnAuthorizations.praDate,
      returnReason: purchaseReturnAuthorizations.returnReason,
      status: purchaseReturnAuthorizations.status,
      expectedDispatchDate: purchaseReturnAuthorizations.expectedDispatchDate,
      returnMode: purchaseReturnAuthorizations.returnMode,
      createdAt: purchaseReturnAuthorizations.createdAt,
      supplierName: suppliers.name,
      poNo: purchaseOrders.poNo,
      grnNo: grns.grnNo,
    })
    .from(purchaseReturnAuthorizations)
    .leftJoin(suppliers, eq(suppliers.id, purchaseReturnAuthorizations.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, purchaseReturnAuthorizations.poId))
    .leftJoin(grns, eq(grns.id, purchaseReturnAuthorizations.grnId))
    .orderBy(desc(purchaseReturnAuthorizations.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { lines = [], ...header } = body;

  // Auto PRA-YYYY-NNNN
  const year = new Date().getFullYear();
  const [{ count }] = await tdb
    .select({ count: sql<number>`count(*)::int` })
    .from(purchaseReturnAuthorizations)
    .where(sql`EXTRACT(YEAR FROM created_at) = ${year}`);
  const praNo = `PRA-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const [pra] = await tdb.insert(purchaseReturnAuthorizations).values({
    praNo,
    praDate: header.praDate,
    supplierId: header.supplierId,
    poId: header.poId || null,
    grnId: header.grnId || null,
    returnReason: header.returnReason,
    description: header.description || null,
    expectedDispatchDate: header.expectedDispatchDate || null,
    returnMode: header.returnMode ?? 'company_ships',
    status: 'draft',
    notes: header.notes || null,
    createdById: session.user.id,
  }).returning();

  if (lines.length > 0) {
    await tdb.insert(praLines).values(
      lines.map((l: any, i: number) => ({
        praId: pra.id,
        grnLineId: l.grnLineId || null,
        productId: l.productId || null,
        hsCode: l.hsCode || null,
        description: l.description,
        returnQty: String(l.returnQty),
        uom: l.uom || null,
        unitPrice: l.unitPrice ? String(l.unitPrice) : null,
        currency: l.currency ?? 'USD',
        lotNo: l.lotNo || null,
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(pra, { status: 201 });
}
