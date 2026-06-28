import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesInquiries, salesInquiryLines, customers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: salesInquiries.id,
      inquiryNo: salesInquiries.inquiryNo,
      date: salesInquiries.date,
      status: salesInquiries.status,
      receivedVia: salesInquiries.receivedVia,
      requiredByDate: salesInquiries.requiredByDate,
      linkedQuotationId: salesInquiries.linkedQuotationId,
      notes: salesInquiries.notes,
      createdAt: salesInquiries.createdAt,
      customerName: customers.name,
      customerCode: customers.code,
    })
    .from(salesInquiries)
    .leftJoin(customers, eq(customers.id, salesInquiries.customerId))
    .orderBy(desc(salesInquiries.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const count = await tdb.$count(salesInquiries);
  const year = new Date().getFullYear();
  const inquiryNo = `INQ-${year}-${String(count + 1).padStart(4, '0')}`;

  const [inquiry] = await tdb.insert(salesInquiries).values({
    inquiryNo,
    date: body.date,
    customerId: body.customerId,
    receivedVia: body.receivedVia ?? 'phone',
    requiredByDate: body.requiredByDate || null,
    notes: body.notes || null,
    status: 'new',
    createdById: session.user.id,
  }).returning();

  if (body.lines?.length) {
    await tdb.insert(salesInquiryLines).values(
      body.lines.map((l: any, i: number) => ({
        inquiryId: inquiry.id,
        productId: l.productId,
        tentativeQty: l.tentativeQty || null,
        uom: l.uom || null,
        targetPricePkr: l.targetPricePkr || null,
        notes: l.notes || null,
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(inquiry, { status: 201 });
}
