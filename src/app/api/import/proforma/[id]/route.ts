import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { proformaInvoices, proformaInvoiceLines, purchaseOrders, purchaseOrderLines, suppliers, products } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [pi] = await tdb
    .select({
      id: proformaInvoices.id,
      piNo: proformaInvoices.piNo,
      piDate: proformaInvoices.piDate,
      poId: proformaInvoices.poId,
      currency: proformaInvoices.currency,
      exchangeRate: proformaInvoices.exchangeRate,
      validityDate: proformaInvoices.validityDate,
      estimatedShipDate: proformaInvoices.estimatedShipDate,
      portOfLoading: proformaInvoices.portOfLoading,
      portOfDischarge: proformaInvoices.portOfDischarge,
      incoterms: proformaInvoices.incoterms,
      freightAmount: proformaInvoices.freightAmount,
      insuranceAmount: proformaInvoices.insuranceAmount,
      totalFobValue: proformaInvoices.totalFobValue,
      totalCifValue: proformaInvoices.totalCifValue,
      totalCifPkr: proformaInvoices.totalCifPkr,
      status: proformaInvoices.status,
      attachmentUrl: proformaInvoices.attachmentUrl,
      notes: proformaInvoices.notes,
      createdAt: proformaInvoices.createdAt,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      supplierEmail: suppliers.email,
      poNo: purchaseOrders.poNo,
    })
    .from(proformaInvoices)
    .leftJoin(suppliers, eq(suppliers.id, proformaInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, proformaInvoices.poId))
    .where(eq(proformaInvoices.id, id));

  if (!pi) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await tdb
    .select({
      id: proformaInvoiceLines.id,
      piId: proformaInvoiceLines.piId,
      poLineId: proformaInvoiceLines.poLineId,
      productId: proformaInvoiceLines.productId,
      hsCode: proformaInvoiceLines.hsCode,
      description: proformaInvoiceLines.description,
      qty: proformaInvoiceLines.qty,
      uom: proformaInvoiceLines.uom,
      unitPrice: proformaInvoiceLines.unitPrice,
      totalValue: proformaInvoiceLines.totalValue,
      sortOrder: proformaInvoiceLines.sortOrder,
      productName: products.name,
    })
    .from(proformaInvoiceLines)
    .leftJoin(products, eq(products.id, proformaInvoiceLines.productId))
    .where(eq(proformaInvoiceLines.piId, id))
    .orderBy(proformaInvoiceLines.sortOrder);

  return NextResponse.json({ ...pi, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { action } = body;

  const ALLOWED: Record<string, string[]> = {
    accept: ['received'],
    supersede: ['received', 'accepted'],
    cancel: ['draft', 'received'],
  };

  const [current] = await tdb.select({ status: proformaInvoices.status })
    .from(proformaInvoices).where(eq(proformaInvoices.id, id));
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action) {
    const allowed = ALLOWED[action] ?? [];
    if (!allowed.includes(current.status)) {
      return NextResponse.json({ error: `Cannot ${action} from status ${current.status}` }, { status: 400 });
    }
    const newStatus = action === 'accept' ? 'accepted' : action === 'supersede' ? 'superseded' : 'cancelled';
    const [updated] = await tdb.update(proformaInvoices)
      .set({ status: newStatus as any, updatedAt: new Date() })
      .where(eq(proformaInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  // Field update
  const { lines, ...fields } = body;
  const updateData: any = { updatedAt: new Date() };
  if (fields.notes !== undefined) updateData.notes = fields.notes;
  if (fields.attachmentUrl !== undefined) updateData.attachmentUrl = fields.attachmentUrl;
  if (fields.validityDate !== undefined) updateData.validityDate = fields.validityDate;
  if (fields.estimatedShipDate !== undefined) updateData.estimatedShipDate = fields.estimatedShipDate;

  const [updated] = await tdb.update(proformaInvoices).set(updateData)
    .where(eq(proformaInvoices.id, id)).returning();
  return NextResponse.json(updated);
}
