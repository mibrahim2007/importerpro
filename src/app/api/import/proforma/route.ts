import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  proformaInvoices, proformaInvoiceLines, purchaseOrders, suppliers, products,
} from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: proformaInvoices.id,
      piNo: proformaInvoices.piNo,
      piDate: proformaInvoices.piDate,
      poId: proformaInvoices.poId,
      currency: proformaInvoices.currency,
      totalCifValue: proformaInvoices.totalCifValue,
      totalCifPkr: proformaInvoices.totalCifPkr,
      status: proformaInvoices.status,
      validityDate: proformaInvoices.validityDate,
      estimatedShipDate: proformaInvoices.estimatedShipDate,
      incoterms: proformaInvoices.incoterms,
      createdAt: proformaInvoices.createdAt,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      poNo: purchaseOrders.poNo,
    })
    .from(proformaInvoices)
    .leftJoin(suppliers, eq(suppliers.id, proformaInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, proformaInvoices.poId))
    .orderBy(desc(proformaInvoices.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { lines = [], ...header } = body;

  // Auto PI sequence using poNo prefix
  const po = await tdb.select({ poNo: purchaseOrders.poNo })
    .from(purchaseOrders).where(eq(purchaseOrders.id, header.poId)).limit(1);
  const poNo = po[0]?.poNo ?? 'PO';

  // Compute FOB totals from lines
  const totalFob = lines.reduce((s: number, l: any) => s + (parseFloat(l.qty || 0) * parseFloat(l.unitPrice || 0)), 0);
  const totalCif = totalFob + parseFloat(header.freightAmount || 0) + parseFloat(header.insuranceAmount || 0);
  const rate = parseFloat(header.exchangeRate || 280);
  const totalCifPkr = totalCif * rate;

  const [pi] = await tdb.insert(proformaInvoices).values({
    piNo: header.piNo,
    piDate: header.piDate,
    poId: header.poId,
    supplierId: header.supplierId,
    currency: header.currency ?? 'USD',
    exchangeRate: String(rate),
    validityDate: header.validityDate || null,
    estimatedShipDate: header.estimatedShipDate || null,
    portOfLoading: header.portOfLoading || null,
    portOfDischarge: header.portOfDischarge || null,
    incoterms: header.incoterms ?? 'CIF',
    freightAmount: String(parseFloat(header.freightAmount || 0)),
    insuranceAmount: String(parseFloat(header.insuranceAmount || 0)),
    totalFobValue: String(totalFob),
    totalCifValue: String(totalCif),
    totalCifPkr: String(totalCifPkr),
    status: 'received',
    notes: header.notes || null,
    createdById: session.user.id,
  }).returning();

  if (lines.length > 0) {
    await tdb.insert(proformaInvoiceLines).values(
      lines.map((l: any, i: number) => ({
        piId: pi.id,
        poLineId: l.poLineId || null,
        productId: l.productId || null,
        hsCode: l.hsCode || null,
        description: l.description,
        qty: String(l.qty),
        uom: l.uom || null,
        unitPrice: String(l.unitPrice),
        totalValue: String(parseFloat(l.qty || 0) * parseFloat(l.unitPrice || 0)),
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(pi, { status: 201 });
}
