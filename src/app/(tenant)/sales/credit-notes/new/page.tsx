import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { customers, salesInvoices, salesInvoiceLines, returnAuthorizations, products } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { CreditNoteForm } from '@/components/sales/credit-note-form';

export const revalidate = 0;

export default async function NewCreditNotePage({ searchParams }: { searchParams: Promise<{ raId?: string; invoiceId?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [customerList, invoiceList] = await Promise.all([
    tdb.select({ id: customers.id, name: customers.name }).from(customers).orderBy(customers.name),
    tdb.select({
      id: salesInvoices.id,
      invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate,
      customerId: salesInvoices.customerId,
      grandTotalPkr: salesInvoices.grandTotalPkr,
    })
    .from(salesInvoices)
    .where(inArray(salesInvoices.status, ['posted', 'partially_paid', 'fully_paid'] as any[]))
    .orderBy(salesInvoices.invoiceDate),
  ]);

  // Pre-load RA and invoice lines if provided
  let preloadedRa: any = null;
  let preloadedLines: any[] = [];
  let preloadedInvoiceId = sp.invoiceId ?? null;

  if (sp.raId) {
    const [raRow] = await tdb
      .select({
        id: returnAuthorizations.id,
        raNo: returnAuthorizations.raNo,
        customerId: returnAuthorizations.customerId,
        invoiceId: returnAuthorizations.invoiceId,
        returnReason: returnAuthorizations.returnReason,
      })
      .from(returnAuthorizations)
      .where(eq(returnAuthorizations.id, sp.raId));
    preloadedRa = raRow ?? null;
    if (raRow?.invoiceId) preloadedInvoiceId = raRow.invoiceId;
  }

  if (preloadedInvoiceId) {
    preloadedLines = await tdb
      .select({
        id: salesInvoiceLines.id,
        productId: salesInvoiceLines.productId,
        hsCode: salesInvoiceLines.hsCode,
        description: salesInvoiceLines.description,
        qty: salesInvoiceLines.qty,
        uom: salesInvoiceLines.uom,
        unitPricePkr: salesInvoiceLines.unitPricePkr,
        salesTaxPct: salesInvoiceLines.salesTaxPct,
        productName: products.name,
      })
      .from(salesInvoiceLines)
      .leftJoin(products, eq(products.id, salesInvoiceLines.productId))
      .where(eq(salesInvoiceLines.invoiceId, preloadedInvoiceId));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Credit Note</h1>
        <p className="text-sm text-slate-500 mt-0.5">Auto-numbered CN-YYYY-NNNN on save · FBR-reported</p>
      </div>
      <CreditNoteForm
        customers={customerList}
        invoices={invoiceList}
        preloadedRa={preloadedRa}
        preloadedInvoiceId={preloadedInvoiceId}
        preloadedLines={preloadedLines}
      />
    </div>
  );
}
