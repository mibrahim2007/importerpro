import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { suppliers, purchaseOrders, grns, grnLines, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PurchaseReturnForm } from '@/components/import/purchase-return-form';

export const revalidate = 0;

export default async function NewPurchaseReturnPage({ searchParams }: { searchParams: Promise<{ grnId?: string; poId?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [supplierList, poList, grnList] = await Promise.all([
    tdb.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    tdb.select({ id: purchaseOrders.id, poNo: purchaseOrders.poNo, supplierId: purchaseOrders.supplierId }).from(purchaseOrders).orderBy(purchaseOrders.poNo),
    tdb.select({ id: grns.id, grnNo: grns.grnNo, poId: grns.poId }).from(grns).orderBy(grns.grnNo),
  ]);

  // Pre-load GRN lines if grnId supplied
  let preloadedLines: any[] = [];
  let preloadedGrn: any = null;

  if (sp.grnId) {
    preloadedGrn = grnList.find(g => g.id === sp.grnId) ?? null;
    if (preloadedGrn) {
      preloadedLines = await tdb
        .select({
          id: grnLines.id,
          productId: grnLines.productId,
          hsCode: grnLines.hsCode,
          receivedQty: grnLines.receivedQty,
          rejectedQty: grnLines.rejectedQty,
          uom: grnLines.uom,
          lotBatchNo: grnLines.lotBatchNo,
          productName: products.name,
        })
        .from(grnLines)
        .leftJoin(products, eq(products.id, grnLines.productId))
        .where(eq(grnLines.grnId, sp.grnId));
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Purchase Return Authorization</h1>
        <p className="text-sm text-slate-500 mt-0.5">Auto-numbered PRA-YYYY-NNNN on save</p>
      </div>
      <PurchaseReturnForm
        suppliers={supplierList}
        purchaseOrders={poList}
        grns={grnList}
        preloadedGrn={preloadedGrn}
        preloadedLines={preloadedLines}
      />
    </div>
  );
}
