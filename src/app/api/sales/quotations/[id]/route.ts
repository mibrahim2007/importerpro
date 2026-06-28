import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import {
  salesQuotations, salesQuotationLines, salesInquiries,
  customers, customerAddresses, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[quotation], lines] = await Promise.all([
    tdb.select({
      id: salesQuotations.id, quotationNo: salesQuotations.quotationNo,
      revisionNo: salesQuotations.revisionNo,
      parentQuotationId: salesQuotations.parentQuotationId,
      date: salesQuotations.date, validUntil: salesQuotations.validUntil,
      status: salesQuotations.status, paymentTerms: salesQuotations.paymentTerms,
      termsConditions: salesQuotations.termsConditions,
      internalNotes: salesQuotations.internalNotes,
      subtotalPkr: salesQuotations.subtotalPkr,
      salesTaxPkr: salesQuotations.salesTaxPkr,
      whtPkr: salesQuotations.whtPkr,
      grandTotalPkr: salesQuotations.grandTotalPkr,
      rejectionReason: salesQuotations.rejectionReason,
      sentAt: salesQuotations.sentAt, acceptedAt: salesQuotations.acceptedAt,
      inquiryId: salesQuotations.inquiryId, createdAt: salesQuotations.createdAt,
      customerId: salesQuotations.customerId,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerStrn: customers.strn,
      customerPhone: customers.phone, customerEmail: customers.email,
      customerBillingAddress: customers.billingAddress,
      whtRatePct: customers.whtRatePct, salesTaxCategory: customers.salesTaxCategory,
    })
    .from(salesQuotations)
    .leftJoin(customers, eq(customers.id, salesQuotations.customerId))
    .where(eq(salesQuotations.id, id)).limit(1),

    tdb.select({
      id: salesQuotationLines.id,
      productId: salesQuotationLines.productId,
      qty: salesQuotationLines.qty,
      uom: salesQuotationLines.uom,
      unitPricePkr: salesQuotationLines.unitPricePkr,
      discountPct: salesQuotationLines.discountPct,
      netUnitPricePkr: salesQuotationLines.netUnitPricePkr,
      totalPkr: salesQuotationLines.totalPkr,
      salesTaxPct: salesQuotationLines.salesTaxPct,
      salesTaxPkr: salesQuotationLines.salesTaxPkr,
      landedCostRefPkr: salesQuotationLines.landedCostRefPkr,
      marginPct: salesQuotationLines.marginPct,
      sortOrder: salesQuotationLines.sortOrder,
      productName: products.name, productCode: products.code, productUom: products.uom,
    })
    .from(salesQuotationLines)
    .leftJoin(products, eq(products.id, salesQuotationLines.productId))
    .where(eq(salesQuotationLines.quotationId, id))
    .orderBy(salesQuotationLines.sortOrder),
  ]);

  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ quotation, lines });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[current]] = await Promise.all([
    tdb.select({ status: salesQuotations.status, inquiryId: salesQuotations.inquiryId })
      .from(salesQuotations).where(eq(salesQuotations.id, id)).limit(1),
  ]);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action } = body;

  if (action === 'send') {
    await tdb.update(salesQuotations)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(salesQuotations.id, id));
    return NextResponse.json({ ok: true });
  }

  if (action === 'accept') {
    await tdb.update(salesQuotations)
      .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(salesQuotations.id, id));
    if (current.inquiryId) {
      await tdb.update(salesInquiries)
        .set({ status: 'won', updatedAt: new Date() })
        .where(eq(salesInquiries.id, current.inquiryId));
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    await tdb.update(salesQuotations)
      .set({ status: 'rejected', rejectionReason: body.reason || null, updatedAt: new Date() })
      .where(eq(salesQuotations.id, id));
    if (current.inquiryId) {
      await tdb.update(salesInquiries)
        .set({ status: 'lost', lossReason: body.reason || null, updatedAt: new Date() })
        .where(eq(salesInquiries.id, current.inquiryId));
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'revise') {
    // Create a new revision quotation copying this one
    const [[qt], lines] = await Promise.all([
      tdb.select().from(salesQuotations).where(eq(salesQuotations.id, id)).limit(1),
      tdb.select().from(salesQuotationLines).where(eq(salesQuotationLines.quotationId, id)),
    ]);
    if (!qt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const count = await tdb.$count(salesQuotations);
    const year = new Date().getFullYear();
    const newNo = `QT-${year}-${String(count + 1).padStart(4, '0')}`;

    const [newQt] = await tdb.insert(salesQuotations).values({
      quotationNo: newNo, revisionNo: (qt.revisionNo ?? 0) + 1,
      parentQuotationId: id, date: qt.date, validUntil: qt.validUntil,
      customerId: qt.customerId, inquiryId: qt.inquiryId,
      paymentTerms: qt.paymentTerms, status: 'draft',
      termsConditions: qt.termsConditions, internalNotes: qt.internalNotes,
      subtotalPkr: qt.subtotalPkr, salesTaxPkr: qt.salesTaxPkr,
      whtPkr: qt.whtPkr, grandTotalPkr: qt.grandTotalPkr,
      createdById: session.user.id,
    }).returning();

    if (lines.length) {
      await tdb.insert(salesQuotationLines).values(
        lines.map((l) => ({ ...l, id: undefined, quotationId: newQt.id } as any))
      );
    }

    await tdb.update(salesQuotations)
      .set({ status: 'revised', updatedAt: new Date() })
      .where(eq(salesQuotations.id, id));

    return NextResponse.json({ id: newQt.id, quotationNo: newQt.quotationNo });
  }

  if (action === 'cancel') {
    await tdb.update(salesQuotations)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(salesQuotations.id, id));
    return NextResponse.json({ ok: true });
  }

  // Field update
  const allowed = ['termsConditions', 'internalNotes', 'validUntil'];
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k] || null;
  await tdb.update(salesQuotations).set(update).where(eq(salesQuotations.id, id));
  return NextResponse.json({ ok: true });
}
