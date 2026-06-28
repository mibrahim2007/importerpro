import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { salesInvoices, salesInvoiceLines, returnAuthorizations, customers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [cn] = await tdb
    .select({
      id: salesInvoices.id,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      customerId: salesInvoices.customerId,
      raId: salesInvoices.raId,
      linkedInvoiceId: salesInvoices.linkedInvoiceId,
      creditApplicationType: salesInvoices.creditApplicationType,
      status: salesInvoices.status,
      subtotalPkr: salesInvoices.subtotalPkr,
      salesTaxPkr: salesInvoices.salesTaxPkr,
      grandTotalPkr: salesInvoices.grandTotalPkr,
      internalNotes: salesInvoices.internalNotes,
      termsConditions: salesInvoices.termsConditions,
      createdAt: salesInvoices.createdAt,
      customerName: customers.name,
      customerNtn: customers.ntn,
      customerStrn: customers.strn,
      customerAddress: customers.billingAddress,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(eq(salesInvoices.id, id));

  if (!cn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await tdb
    .select({
      id: salesInvoiceLines.id,
      productId: salesInvoiceLines.productId,
      hsCode: salesInvoiceLines.hsCode,
      description: salesInvoiceLines.description,
      qty: salesInvoiceLines.qty,
      uom: salesInvoiceLines.uom,
      unitPricePkr: salesInvoiceLines.unitPricePkr,
      taxableValuePkr: salesInvoiceLines.taxableValuePkr,
      salesTaxPct: salesInvoiceLines.salesTaxPct,
      salesTaxPkr: salesInvoiceLines.salesTaxPkr,
      sortOrder: salesInvoiceLines.sortOrder,
      productName: products.name,
    })
    .from(salesInvoiceLines)
    .leftJoin(products, eq(products.id, salesInvoiceLines.productId))
    .where(eq(salesInvoiceLines.invoiceId, id))
    .orderBy(salesInvoiceLines.sortOrder);

  // Fetch linked original invoice if any
  let linkedInvoice = null;
  if (cn.linkedInvoiceId) {
    const [inv] = await tdb.select({ invoiceNo: salesInvoices.invoiceNo, invoiceDate: salesInvoices.invoiceDate })
      .from(salesInvoices).where(eq(salesInvoices.id, cn.linkedInvoiceId));
    linkedInvoice = inv ?? null;
  }

  return NextResponse.json({ ...cn, lines, linkedInvoice });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { action } = body;

  const [cn] = await tdb.select({ status: salesInvoices.status, grandTotalPkr: salesInvoices.grandTotalPkr, linkedInvoiceId: salesInvoices.linkedInvoiceId, creditApplicationType: salesInvoices.creditApplicationType, raId: salesInvoices.raId })
    .from(salesInvoices).where(eq(salesInvoices.id, id));
  if (!cn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'post') {
    // Post the credit note → if applied_to_invoice, reduce original invoice balance
    const [updated] = await tdb.update(salesInvoices)
      .set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() })
      .where(eq(salesInvoices.id, id)).returning();

    if (cn.creditApplicationType === 'applied_to_invoice' && cn.linkedInvoiceId) {
      const [origInv] = await tdb.select({
        amountReceivedPkr: salesInvoices.amountReceivedPkr,
        grandTotalPkr: salesInvoices.grandTotalPkr,
        status: salesInvoices.status,
      }).from(salesInvoices).where(eq(salesInvoices.id, cn.linkedInvoiceId));

      if (origInv) {
        const creditAmt = parseFloat(String(cn.grandTotalPkr));
        const received = parseFloat(String(origInv.amountReceivedPkr ?? '0')) + creditAmt;
        const balance = parseFloat(String(origInv.grandTotalPkr)) - received;
        const newStatus = balance <= 0 ? 'fully_paid' : received > 0 ? 'partially_paid' : origInv.status;
        await tdb.update(salesInvoices)
          .set({
            amountReceivedPkr: String(Math.min(received, parseFloat(String(origInv.grandTotalPkr)))),
            balancePkr: String(Math.max(0, balance)),
            status: newStatus as any,
            updatedAt: new Date(),
          })
          .where(eq(salesInvoices.id, cn.linkedInvoiceId));
      }
    }

    // Update RA to closed if linked
    if (cn.raId) {
      await tdb.update(returnAuthorizations)
        .set({ creditNoteId: id, status: 'credit_issued', updatedAt: new Date() })
        .where(eq(returnAuthorizations.id, cn.raId));
    }

    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    if (!['draft', 'posted'].includes(cn.status ?? '')) {
      return NextResponse.json({ error: 'Cannot cancel this credit note' }, { status: 400 });
    }
    const [updated] = await tdb.update(salesInvoices)
      .set({ status: 'cancelled', cancellationReason: body.reason || null, cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(salesInvoices.id, id)).returning();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
