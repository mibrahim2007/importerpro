import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { customers, salesInvoices, salesInvoiceLines, products } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ReturnForm } from '@/components/sales/return-form';

export const revalidate = 0;

export default async function NewReturnPage({ searchParams }: { searchParams: Promise<{ invoiceId?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  // Only fetch posted/partially_paid/fully_paid invoices for selection
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

  // Pre-load invoice lines if an invoiceId is given
  let preloadedLines: any[] = [];
  let preloadedInvoice: any = null;
  if (sp.invoiceId) {
    preloadedInvoice = invoiceList.find(i => i.id === sp.invoiceId) ?? null;
    if (preloadedInvoice) {
      preloadedLines = await tdb
        .select({
          id: salesInvoiceLines.id,
          productId: salesInvoiceLines.productId,
          hsCode: salesInvoiceLines.hsCode,
          description: salesInvoiceLines.description,
          qty: salesInvoiceLines.qty,
          uom: salesInvoiceLines.uom,
          unitPricePkr: salesInvoiceLines.unitPricePkr,
          productName: products.name,
        })
        .from(salesInvoiceLines)
        .leftJoin(products, eq(products.id, salesInvoiceLines.productId))
        .where(eq(salesInvoiceLines.invoiceId, sp.invoiceId));
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Return Authorization</h1>
        <p className="text-sm text-slate-500 mt-0.5">Auto-numbered RA-YYYY-NNNN on save</p>
      </div>
      <ReturnForm
        customers={customerList}
        invoices={invoiceList}
        preloadedInvoice={preloadedInvoice}
        preloadedLines={preloadedLines}
      />
    </div>
  );
}
