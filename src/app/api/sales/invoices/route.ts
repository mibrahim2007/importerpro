import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { salesInvoices, salesInvoiceLines, customers } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const PAYMENT_TERM_DAYS: Record<string, number> = {
  net_7: 7, net_30: 30, net_60: 60, net_90: 90, advance: 0, cod: 0,
};

function calcDueDate(invoiceDate: string, paymentTerms: string): string {
  const days = PAYMENT_TERM_DAYS[paymentTerms] ?? 30;
  const d = new Date(invoiceDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const customerIdFilter = req.nextUrl.searchParams.get('customerId');

  const cols = {
    id: salesInvoices.id, invoiceNo: salesInvoices.invoiceNo,
    invoiceDate: salesInvoices.invoiceDate, invoiceType: salesInvoices.invoiceType,
    status: salesInvoices.status, dueDate: salesInvoices.dueDate,
    grandTotalPkr: salesInvoices.grandTotalPkr, balancePkr: salesInvoices.balancePkr,
    amountReceivedPkr: salesInvoices.amountReceivedPkr,
    fbrStatus: salesInvoices.fbrStatus, fbrInvoiceNo: salesInvoices.fbrInvoiceNo,
    dcId: salesInvoices.dcId, soId: salesInvoices.soId,
    createdAt: salesInvoices.createdAt, postedAt: salesInvoices.postedAt,
    customerName: customers.name, customerId: salesInvoices.customerId,
  };
  const base = tdb.select(cols).from(salesInvoices).leftJoin(customers, eq(customers.id, salesInvoices.customerId));
  const rows = customerIdFilter
    ? await base.where(eq(salesInvoices.customerId, customerIdFilter)).orderBy(desc(salesInvoices.createdAt))
    : await base.orderBy(desc(salesInvoices.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const {
    invoiceDate, invoiceType = 'tax_invoice', dcId, soId, customerId,
    paymentTerms = 'net_30', internalNotes, termsConditions, lines,
  } = body;

  // Auto-number: INV-YYYY-NNNN
  const year = new Date(invoiceDate).getFullYear();
  const [{ count }] = await tdb.select({ count: sql<number>`count(*)` }).from(salesInvoices);
  const seq = String(Number(count) + 1).padStart(4, '0');
  const invoiceNo = `INV-${year}-${seq}`;

  const dueDate = calcDueDate(invoiceDate, paymentTerms);

  // Calculate line totals
  let subtotal = 0;
  let salesTaxTotal = 0;

  const processedLines = (lines as any[]).map((l: any, i: number) => {
    const qty = parseFloat(l.qty || '0');
    const unitPrice = parseFloat(l.unitPricePkr || '0');
    const discountPkr = parseFloat(l.discountPkr || '0');
    const taxableValue = qty * unitPrice - discountPkr;
    const taxPct = parseFloat(l.salesTaxPct || '17');
    const salesTaxPkr = taxableValue * (taxPct / 100);
    subtotal += taxableValue;
    salesTaxTotal += salesTaxPkr;
    return {
      dcLineId: l.dcLineId ?? null, productId: l.productId ?? null,
      hsCode: l.hsCode ?? null, description: l.description,
      qty: String(qty), uom: l.uom ?? null,
      unitPricePkr: String(unitPrice), discountPkr: String(discountPkr),
      taxableValuePkr: String(taxableValue.toFixed(2)),
      salesTaxPct: String(taxPct), salesTaxPkr: String(salesTaxPkr.toFixed(2)),
      sortOrder: i,
    };
  });

  // WHT from customer
  const [cust] = await tdb.select({ whtRatePct: customers.whtRatePct }).from(customers).where(eq(customers.id, customerId)).limit(1);
  const grandTotal = subtotal + salesTaxTotal;
  const whtPkr = grandTotal * ((parseFloat(String(cust?.whtRatePct ?? '0'))) / 100);

  const [inserted] = await tdb.insert(salesInvoices).values({
    invoiceNo, invoiceDate, invoiceType, dcId: dcId ?? null, soId: soId ?? null,
    customerId, paymentTerms, dueDate, status: 'draft',
    subtotalPkr: String(subtotal.toFixed(2)),
    salesTaxPkr: String(salesTaxTotal.toFixed(2)),
    whtPkr: String(whtPkr.toFixed(2)),
    grandTotalPkr: String(grandTotal.toFixed(2)),
    balancePkr: String(grandTotal.toFixed(2)),
    internalNotes: internalNotes ?? null, termsConditions: termsConditions ?? null,
  }).returning();

  if (processedLines.length) {
    await tdb.insert(salesInvoiceLines).values(processedLines.map((l) => ({ ...l, invoiceId: inserted.id })));
  }

  return NextResponse.json(inserted, { status: 201 });
}
