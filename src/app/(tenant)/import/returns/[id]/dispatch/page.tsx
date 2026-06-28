import { auth } from '@/lib/auth/config';
import { redirect, notFound } from 'next/navigation';
import { getTenantDb } from '@/db';
import { purchaseReturnAuthorizations, praLines, warehouses, products, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PurchaseReturnDispatchForm } from '@/components/import/purchase-return-dispatch-form';

export const revalidate = 0;

export default async function PurchaseReturnDispatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: praId } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[pra], praLineList, warehouseList] = await Promise.all([
    tdb.select({
      id: purchaseReturnAuthorizations.id,
      praNo: purchaseReturnAuthorizations.praNo,
      status: purchaseReturnAuthorizations.status,
      supplierName: suppliers.name,
    })
    .from(purchaseReturnAuthorizations)
    .leftJoin(suppliers, eq(suppliers.id, purchaseReturnAuthorizations.supplierId))
    .where(eq(purchaseReturnAuthorizations.id, praId)),

    tdb.select({
      id: praLines.id,
      productId: praLines.productId,
      description: praLines.description,
      returnQty: praLines.returnQty,
      dispatchedQty: praLines.dispatchedQty,
      uom: praLines.uom,
      lotNo: praLines.lotNo,
      unitPrice: praLines.unitPrice,
      currency: praLines.currency,
      productName: products.name,
    })
    .from(praLines)
    .leftJoin(products, eq(products.id, praLines.productId))
    .where(eq(praLines.praId, praId))
    .orderBy(praLines.sortOrder),

    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
  ]);

  if (!pra) notFound();
  if (pra.status !== 'approved') redirect(`/import/returns/${praId}`);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dispatch Return Goods</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          PRA: <strong>{pra.praNo}</strong> · Supplier: <strong>{pra.supplierName}</strong>
        </p>
      </div>
      <PurchaseReturnDispatchForm
        praId={praId}
        praNo={pra.praNo ?? ''}
        praLines={praLineList}
        warehouses={warehouseList}
      />
    </div>
  );
}
