import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import {
  suppliers, purchaseOrders, vendorBills,
  purchaseReturnAuthorizations, praLines, products,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PurchaseDebitNoteForm } from '@/components/import/purchase-debit-note-form';

export const revalidate = 0;

export default async function NewDebitNotePage({ searchParams }: { searchParams: Promise<{ praId?: string; billId?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [supplierList, billList] = await Promise.all([
    tdb.select({ id: suppliers.id, name: suppliers.name, country: suppliers.country }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    tdb.select({
      id: vendorBills.id,
      billNo: vendorBills.billNo,
      supplierId: vendorBills.supplierId,
      totalAmountPkr: vendorBills.totalAmountPkr,
      balanceDue: vendorBills.balanceDue,
    })
    .from(vendorBills)
    .where(eq(vendorBills.status, 'posted'))
    .orderBy(vendorBills.billDate),
  ]);

  // Pre-load PRA if provided
  let preloadedPra: any = null;
  let preloadedLines: any[] = [];
  let preloadedSupplierId: string | null = null;

  if (sp.praId) {
    const [pra] = await tdb.select({
      id: purchaseReturnAuthorizations.id,
      praNo: purchaseReturnAuthorizations.praNo,
      supplierId: purchaseReturnAuthorizations.supplierId,
      poId: purchaseReturnAuthorizations.poId,
    })
    .from(purchaseReturnAuthorizations)
    .where(eq(purchaseReturnAuthorizations.id, sp.praId));

    if (pra) {
      preloadedPra = pra;
      preloadedSupplierId = pra.supplierId;
      preloadedLines = await tdb
        .select({
          id: praLines.id,
          productId: praLines.productId,
          description: praLines.description,
          returnQty: praLines.returnQty,
          uom: praLines.uom,
          unitPrice: praLines.unitPrice,
          currency: praLines.currency,
          productName: products.name,
        })
        .from(praLines)
        .leftJoin(products, eq(products.id, praLines.productId))
        .where(eq(praLines.praId, sp.praId));
    }
  }

  const preloadedBillId = sp.billId ?? null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Debit Note</h1>
        <p className="text-sm text-slate-500 mt-0.5">Auto-numbered DN-YYYY-NNNN on save · Reduces supplier payable</p>
      </div>
      <PurchaseDebitNoteForm
        suppliers={supplierList}
        bills={billList}
        preloadedPra={preloadedPra}
        preloadedLines={preloadedLines}
        preloadedSupplierId={preloadedSupplierId}
        preloadedBillId={preloadedBillId}
      />
    </div>
  );
}
