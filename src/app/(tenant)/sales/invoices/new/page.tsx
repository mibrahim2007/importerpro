import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers, dispatchChallans, dispatchChallanLines, salesOrders, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { InvoiceForm } from '@/components/sales/invoice-form';

export const revalidate = 0;

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ dcId?: string; soId?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { dcId, soId } = await searchParams;

  const tdb = await getTenantDb(session.user.tenantSlug);

  const allCustomers = await tdb.select({ id: customers.id, name: customers.name, code: customers.code, ntn: customers.ntn, strn: customers.strn, paymentTerms: customers.paymentTerms, whtRatePct: customers.whtRatePct, salesTaxCategory: customers.salesTaxCategory }).from(customers).where(eq(customers.isActive, true));

  // Prefill from DC
  let prefillDc: any = null;
  if (dcId) {
    const [[dc], dcLines] = await Promise.all([
      tdb.select({
        id: dispatchChallans.id, dcNo: dispatchChallans.dcNo, dcDate: dispatchChallans.dcDate,
        customerId: dispatchChallans.customerId, soId: dispatchChallans.soId,
      })
      .from(dispatchChallans).where(eq(dispatchChallans.id, dcId)).limit(1),

      tdb.select({
        id: dispatchChallanLines.id, productId: dispatchChallanLines.productId,
        dispatchedQty: dispatchChallanLines.dispatchedQty, uom: dispatchChallanLines.uom,
        sortOrder: dispatchChallanLines.sortOrder,
        productName: products.name, productCode: products.code, hsCode: products.hsCode,
      })
      .from(dispatchChallanLines)
      .leftJoin(products, eq(products.id, dispatchChallanLines.productId))
      .where(eq(dispatchChallanLines.dcId, dcId))
      .orderBy(dispatchChallanLines.sortOrder),
    ]);
    if (dc) prefillDc = { ...dc, lines: dcLines };
  }

  // Prefill from SO
  let prefillSo: any = null;
  if (soId && !dcId) {
    const [so] = await tdb.select({ id: salesOrders.id, soNo: salesOrders.soNo, customerId: salesOrders.customerId, paymentTerms: salesOrders.paymentTerms }).from(salesOrders).where(eq(salesOrders.id, soId)).limit(1);
    if (so) prefillSo = so;
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New Invoice</h1>
        <p className="text-sm text-slate-500">
          {prefillDc ? `From DC: ${prefillDc.dcNo}` : prefillSo ? `From SO: ${prefillSo.soNo}` : 'Standalone invoice'}
        </p>
      </div>
      <InvoiceForm customers={allCustomers} prefillDc={prefillDc} prefillSo={prefillSo} />
    </div>
  );
}
