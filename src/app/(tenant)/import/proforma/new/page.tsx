import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { purchaseOrders, suppliers, poLines, products } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ProformaForm } from '@/components/import/proforma-form';

export const revalidate = 0;

export default async function NewProformaPage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const sp = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const allPOs = await tdb
    .select({
      id: purchaseOrders.id,
      poNo: purchaseOrders.poNo,
      supplierId: purchaseOrders.supplierId,
      cifValueUsd: purchaseOrders.cifValueUsd,
      incoterms: purchaseOrders.incoterms,
      currency: purchaseOrders.currency,
      portOfLoading: purchaseOrders.portOfLoading,
      portOfDischarge: purchaseOrders.portOfDischarge,
    })
    .from(purchaseOrders)
    .orderBy(desc(purchaseOrders.createdAt));

  const allSuppliers = await tdb
    .select({ id: suppliers.id, name: suppliers.name, country: suppliers.country })
    .from(suppliers);

  // If poId provided, pre-load its lines
  let preloadedLines: any[] = [];
  if (sp.poId) {
    preloadedLines = await tdb
      .select({
        id: poLines.id,
        productId: poLines.productId,
        hsCode: poLines.hsCode,
        qty: poLines.qty,
        uom: poLines.uom,
        unitPrice: poLines.unitPrice,
        totalPrice: poLines.totalPrice,
        productName: products.name,
      })
      .from(poLines)
      .leftJoin(products, eq(products.id, poLines.productId))
      .where(eq(poLines.poId, sp.poId));
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New Proforma Invoice</h1>
        <p className="text-sm text-slate-500">Record a PI received from your supplier</p>
      </div>
      <ProformaForm
        purchaseOrders={allPOs}
        suppliers={allSuppliers}
        preloadedPoId={sp.poId}
        preloadedLines={preloadedLines}
      />
    </div>
  );
}
