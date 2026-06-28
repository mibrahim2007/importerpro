import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { returnAuthorizations, returnAuthorizationLines, customers, salesInvoices } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: returnAuthorizations.id,
      raNo: returnAuthorizations.raNo,
      raDate: returnAuthorizations.raDate,
      returnReason: returnAuthorizations.returnReason,
      status: returnAuthorizations.status,
      expectedReturnDate: returnAuthorizations.expectedReturnDate,
      returnMode: returnAuthorizations.returnMode,
      createdAt: returnAuthorizations.createdAt,
      customerName: customers.name,
      invoiceNo: salesInvoices.invoiceNo,
    })
    .from(returnAuthorizations)
    .leftJoin(customers, eq(customers.id, returnAuthorizations.customerId))
    .leftJoin(salesInvoices, eq(salesInvoices.id, returnAuthorizations.invoiceId))
    .orderBy(desc(returnAuthorizations.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { lines = [], ...header } = body;

  // Auto RA-YYYY-NNNN
  const year = new Date().getFullYear();
  const [{ count }] = await tdb
    .select({ count: sql<number>`count(*)::int` })
    .from(returnAuthorizations)
    .where(sql`EXTRACT(YEAR FROM created_at) = ${year}`);
  const raNo = `RA-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const [ra] = await tdb.insert(returnAuthorizations).values({
    raNo,
    raDate: header.raDate,
    customerId: header.customerId,
    invoiceId: header.invoiceId,
    returnReason: header.returnReason,
    description: header.description || null,
    expectedReturnDate: header.expectedReturnDate || null,
    returnMode: header.returnMode ?? 'customer_delivers',
    status: 'draft',
    notes: header.notes || null,
    createdById: session.user.id,
  }).returning();

  if (lines.length > 0) {
    await tdb.insert(returnAuthorizationLines).values(
      lines.map((l: any, i: number) => ({
        raId: ra.id,
        invoiceLineId: l.invoiceLineId || null,
        productId: l.productId || null,
        hsCode: l.hsCode || null,
        description: l.description,
        returnQty: String(l.returnQty),
        uom: l.uom || null,
        unitPricePkr: l.unitPricePkr ? String(l.unitPricePkr) : null,
        lotNo: l.lotNo || null,
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(ra, { status: 201 });
}
