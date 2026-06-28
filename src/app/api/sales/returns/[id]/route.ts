import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  returnAuthorizations, returnAuthorizationLines,
  customers, salesInvoices, salesInvoiceLines, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [ra] = await tdb
    .select({
      id: returnAuthorizations.id,
      raNo: returnAuthorizations.raNo,
      raDate: returnAuthorizations.raDate,
      customerId: returnAuthorizations.customerId,
      invoiceId: returnAuthorizations.invoiceId,
      returnReason: returnAuthorizations.returnReason,
      description: returnAuthorizations.description,
      expectedReturnDate: returnAuthorizations.expectedReturnDate,
      returnMode: returnAuthorizations.returnMode,
      status: returnAuthorizations.status,
      approvedAt: returnAuthorizations.approvedAt,
      cancelledReason: returnAuthorizations.cancelledReason,
      creditNoteId: returnAuthorizations.creditNoteId,
      notes: returnAuthorizations.notes,
      createdAt: returnAuthorizations.createdAt,
      customerName: customers.name,
      customerNtn: customers.ntn,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      invoiceGrandTotal: salesInvoices.grandTotalPkr,
    })
    .from(returnAuthorizations)
    .leftJoin(customers, eq(customers.id, returnAuthorizations.customerId))
    .leftJoin(salesInvoices, eq(salesInvoices.id, returnAuthorizations.invoiceId))
    .where(eq(returnAuthorizations.id, id));

  if (!ra) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await tdb
    .select({
      id: returnAuthorizationLines.id,
      invoiceLineId: returnAuthorizationLines.invoiceLineId,
      productId: returnAuthorizationLines.productId,
      hsCode: returnAuthorizationLines.hsCode,
      description: returnAuthorizationLines.description,
      returnQty: returnAuthorizationLines.returnQty,
      uom: returnAuthorizationLines.uom,
      unitPricePkr: returnAuthorizationLines.unitPricePkr,
      lotNo: returnAuthorizationLines.lotNo,
      sortOrder: returnAuthorizationLines.sortOrder,
      productName: products.name,
    })
    .from(returnAuthorizationLines)
    .leftJoin(products, eq(products.id, returnAuthorizationLines.productId))
    .where(eq(returnAuthorizationLines.raId, id))
    .orderBy(returnAuthorizationLines.sortOrder);

  return NextResponse.json({ ...ra, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { action } = body;

  const [current] = await tdb
    .select({ status: returnAuthorizations.status })
    .from(returnAuthorizations)
    .where(eq(returnAuthorizations.id, id));

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'approve') {
    if (current.status !== 'draft') return NextResponse.json({ error: 'Can only approve draft RAs' }, { status: 400 });
    const [updated] = await tdb
      .update(returnAuthorizations)
      .set({ status: 'approved', approvedById: session.user.id, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(returnAuthorizations.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    if (['credit_issued', 'closed', 'cancelled'].includes(current.status ?? '')) {
      return NextResponse.json({ error: `Cannot cancel RA in ${current.status} status` }, { status: 400 });
    }
    const [updated] = await tdb
      .update(returnAuthorizations)
      .set({ status: 'cancelled', cancelledReason: body.reason || null, updatedAt: new Date() })
      .where(eq(returnAuthorizations.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  if (action === 'set_credit_note') {
    const [updated] = await tdb
      .update(returnAuthorizations)
      .set({ creditNoteId: body.creditNoteId, status: 'credit_issued', updatedAt: new Date() })
      .where(eq(returnAuthorizations.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  if (action === 'close') {
    const [updated] = await tdb
      .update(returnAuthorizations)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(returnAuthorizations.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
