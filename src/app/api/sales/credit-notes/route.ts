import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  salesInvoices, salesInvoiceLines, returnAuthorizations, customers,
} from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: salesInvoices.id,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      linkedInvoiceId: salesInvoices.linkedInvoiceId,
      raId: salesInvoices.raId,
      status: salesInvoices.status,
      creditApplicationType: salesInvoices.creditApplicationType,
      grandTotalPkr: salesInvoices.grandTotalPkr,
      salesTaxPkr: salesInvoices.salesTaxPkr,
      subtotalPkr: salesInvoices.subtotalPkr,
      createdAt: salesInvoices.createdAt,
      customerName: customers.name,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(eq(salesInvoices.invoiceType, 'credit_note'))
    .orderBy(desc(salesInvoices.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { lines = [], ...header } = body;

  // Auto CN-YYYY-NNNN
  const year = new Date().getFullYear();
  const [{ count }] = await tdb
    .select({ count: sql<number>`count(*)::int` })
    .from(salesInvoices)
    .where(sql`invoice_type = 'credit_note' AND EXTRACT(YEAR FROM created_at) = ${year}`);
  const invoiceNo = `CN-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  // Compute totals from lines
  const subtotal = lines.reduce((s: number, l: any) =>
    s + parseFloat(l.qty || 0) * parseFloat(l.unitPricePkr || 0), 0);
  const salesTax = lines.reduce((s: number, l: any) =>
    s + parseFloat(l.salesTaxPkr || 0), 0);
  const grandTotal = subtotal + salesTax;

  const [cn] = await tdb.insert(salesInvoices).values({
    invoiceNo,
    invoiceDate: header.invoiceDate,
    invoiceType: 'credit_note',
    customerId: header.customerId,
    raId: header.raId || null,
    linkedInvoiceId: header.linkedInvoiceId || null,
    creditApplicationType: header.creditApplicationType ?? 'applied_to_invoice',
    paymentTerms: 'advance',
    status: 'draft',
    subtotalPkr: String(subtotal),
    salesTaxPkr: String(salesTax),
    grandTotalPkr: String(grandTotal),
    whtPkr: '0',
    amountReceivedPkr: '0',
    balancePkr: String(grandTotal),
    internalNotes: header.internalNotes || null,
    termsConditions: header.termsConditions || null,
    createdById: session.user.id,
  }).returning();

  if (lines.length > 0) {
    await tdb.insert(salesInvoiceLines).values(
      lines.map((l: any, i: number) => ({
        invoiceId: cn.id,
        productId: l.productId || null,
        hsCode: l.hsCode || null,
        description: l.description,
        qty: String(l.qty),
        uom: l.uom || null,
        unitPricePkr: String(l.unitPricePkr),
        discountPkr: '0',
        taxableValuePkr: String(parseFloat(l.qty || 0) * parseFloat(l.unitPricePkr || 0)),
        salesTaxPct: String(l.salesTaxPct ?? 17),
        salesTaxPkr: String(l.salesTaxPkr ?? 0),
        sortOrder: i,
      }))
    );
  }

  return NextResponse.json(cn, { status: 201 });
}
