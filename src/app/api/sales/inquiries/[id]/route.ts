import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesInquiries, salesInquiryLines, customers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';

const ALLOWED_FROM: Record<string, string[]> = {
  quoted: ['new'],
  won: ['quoted'],
  lost: ['new', 'quoted'],
  cancelled: ['new', 'quoted'],
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[inquiry], lines] = await Promise.all([
    tdb.select({
      id: salesInquiries.id, inquiryNo: salesInquiries.inquiryNo, date: salesInquiries.date,
      status: salesInquiries.status, receivedVia: salesInquiries.receivedVia,
      requiredByDate: salesInquiries.requiredByDate, notes: salesInquiries.notes,
      lossReason: salesInquiries.lossReason, linkedQuotationId: salesInquiries.linkedQuotationId,
      createdAt: salesInquiries.createdAt, customerId: salesInquiries.customerId,
      customerName: customers.name, customerCode: customers.code,
      customerPhone: customers.phone, salesTaxCategory: customers.salesTaxCategory,
    })
    .from(salesInquiries)
    .leftJoin(customers, eq(customers.id, salesInquiries.customerId))
    .where(eq(salesInquiries.id, id)).limit(1),

    tdb.select({
      id: salesInquiryLines.id, inquiryId: salesInquiryLines.inquiryId,
      productId: salesInquiryLines.productId, tentativeQty: salesInquiryLines.tentativeQty,
      uom: salesInquiryLines.uom, targetPricePkr: salesInquiryLines.targetPricePkr,
      notes: salesInquiryLines.notes, sortOrder: salesInquiryLines.sortOrder,
      productName: products.name, productCode: products.code,
    })
    .from(salesInquiryLines)
    .leftJoin(products, eq(products.id, salesInquiryLines.productId))
    .where(eq(salesInquiryLines.inquiryId, id))
    .orderBy(salesInquiryLines.sortOrder),
  ]);

  if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ inquiry, lines });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[current]] = await Promise.all([
    tdb.select({ status: salesInquiries.status }).from(salesInquiries).where(eq(salesInquiries.id, id)).limit(1),
  ]);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action } = body;
  if (action && ALLOWED_FROM[action]) {
    if (!ALLOWED_FROM[action].includes(current.status ?? '')) {
      return NextResponse.json({ error: `Cannot move to ${action} from ${current.status}` }, { status: 422 });
    }
    await tdb.update(salesInquiries).set({
      status: action as any,
      lossReason: action === 'lost' ? (body.lossReason || null) : undefined,
      linkedQuotationId: action === 'quoted' ? (body.quotationId || null) : undefined,
      updatedAt: new Date(),
    }).where(eq(salesInquiries.id, id));
    return NextResponse.json({ ok: true });
  }

  // Field update
  const allowed = ['notes', 'receivedVia', 'requiredByDate'];
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k] || null;
  await tdb.update(salesInquiries).set(update).where(eq(salesInquiries.id, id));
  return NextResponse.json({ ok: true });
}
