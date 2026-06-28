import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  commercialInvoices, commercialInvoiceLines,
  purchaseOrders, suppliers, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [ci] = await tdb
    .select({
      id: commercialInvoices.id,
      ciNo: commercialInvoices.ciNo,
      ciDate: commercialInvoices.ciDate,
      poId: commercialInvoices.poId,
      piId: commercialInvoices.piId,
      lcId: commercialInvoices.lcId,
      shipmentId: commercialInvoices.shipmentId,
      currency: commercialInvoices.currency,
      exchangeRate: commercialInvoices.exchangeRate,
      portOfLoading: commercialInvoices.portOfLoading,
      portOfDischarge: commercialInvoices.portOfDischarge,
      incoterms: commercialInvoices.incoterms,
      netWeightKg: commercialInvoices.netWeightKg,
      grossWeightKg: commercialInvoices.grossWeightKg,
      packageCount: commercialInvoices.packageCount,
      marksNumbers: commercialInvoices.marksNumbers,
      countryOfOrigin: commercialInvoices.countryOfOrigin,
      freightAmount: commercialInvoices.freightAmount,
      insuranceAmount: commercialInvoices.insuranceAmount,
      totalFobValue: commercialInvoices.totalFobValue,
      totalCifValue: commercialInvoices.totalCifValue,
      totalCifPkr: commercialInvoices.totalCifPkr,
      status: commercialInvoices.status,
      matchStatus: commercialInvoices.matchStatus,
      matchSummary: commercialInvoices.matchSummary,
      attachmentUrl: commercialInvoices.attachmentUrl,
      notes: commercialInvoices.notes,
      createdAt: commercialInvoices.createdAt,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      poNo: purchaseOrders.poNo,
    })
    .from(commercialInvoices)
    .leftJoin(suppliers, eq(suppliers.id, commercialInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, commercialInvoices.poId))
    .where(eq(commercialInvoices.id, id));

  if (!ci) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await tdb
    .select({
      id: commercialInvoiceLines.id,
      poLineId: commercialInvoiceLines.poLineId,
      productId: commercialInvoiceLines.productId,
      hsCode: commercialInvoiceLines.hsCode,
      description: commercialInvoiceLines.description,
      qty: commercialInvoiceLines.qty,
      uom: commercialInvoiceLines.uom,
      unitPrice: commercialInvoiceLines.unitPrice,
      totalValue: commercialInvoiceLines.totalValue,
      poQty: commercialInvoiceLines.poQty,
      poUnitPrice: commercialInvoiceLines.poUnitPrice,
      qtyVariancePct: commercialInvoiceLines.qtyVariancePct,
      priceVariancePct: commercialInvoiceLines.priceVariancePct,
      varianceFlag: commercialInvoiceLines.varianceFlag,
      sortOrder: commercialInvoiceLines.sortOrder,
      productName: products.name,
    })
    .from(commercialInvoiceLines)
    .leftJoin(products, eq(products.id, commercialInvoiceLines.productId))
    .where(eq(commercialInvoiceLines.ciId, id))
    .orderBy(commercialInvoiceLines.sortOrder);

  const parsedSummary = ci.matchSummary ? JSON.parse(ci.matchSummary as string) : null;

  return NextResponse.json({ ...ci, matchSummary: parsedSummary, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { action } = body;

  const [current] = await tdb.select({ status: commercialInvoices.status })
    .from(commercialInvoices).where(eq(commercialInvoices.id, id));
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'verify') {
    const [updated] = await tdb.update(commercialInvoices)
      .set({ status: 'verified', updatedAt: new Date() })
      .where(eq(commercialInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'mark_matched') {
    const [updated] = await tdb.update(commercialInvoices)
      .set({ status: 'matched', matchStatus: 'matched', updatedAt: new Date() })
      .where(eq(commercialInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'mark_discrepant') {
    const [updated] = await tdb.update(commercialInvoices)
      .set({ status: 'discrepant', matchStatus: 'discrepant', updatedAt: new Date() })
      .where(eq(commercialInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    const [updated] = await tdb.update(commercialInvoices)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(commercialInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  // Field update
  const updateData: any = { updatedAt: new Date() };
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.attachmentUrl !== undefined) updateData.attachmentUrl = body.attachmentUrl;
  if (body.shipmentId !== undefined) updateData.shipmentId = body.shipmentId;

  const [updated] = await tdb.update(commercialInvoices).set(updateData)
    .where(eq(commercialInvoices.id, id)).returning();
  return NextResponse.json(updated);
}
