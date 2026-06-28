import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { purchaseOrders, suppliers, poLines, products, proformaInvoices, letterOfCredits, shipments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { CommercialInvoiceForm } from '@/components/import/commercial-invoice-form';

export const revalidate = 0;

export default async function NewCommercialPage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string; piId?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const sp = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allPOs, allSuppliers, allPIs, allLCs, allShipments] = await Promise.all([
    tdb.select({
      id: purchaseOrders.id, poNo: purchaseOrders.poNo, supplierId: purchaseOrders.supplierId,
      incoterms: purchaseOrders.incoterms, currency: purchaseOrders.currency,
      portOfLoading: purchaseOrders.portOfLoading, portOfDischarge: purchaseOrders.portOfDischarge,
    }).from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt)),

    tdb.select({ id: suppliers.id, name: suppliers.name, country: suppliers.country }).from(suppliers),

    tdb.select({ id: proformaInvoices.id, piNo: proformaInvoices.piNo, poId: proformaInvoices.poId })
      .from(proformaInvoices),

    tdb.select({ id: letterOfCredits.id, lcNo: letterOfCredits.lcNo, poId: letterOfCredits.poId })
      .from(letterOfCredits),

    tdb.select({ id: shipments.id, shipmentNo: shipments.shipmentNo, blNo: shipments.blNo })
      .from(shipments).orderBy(desc(shipments.createdAt)),
  ]);

  let preloadedLines: any[] = [];
  if (sp.poId) {
    preloadedLines = await tdb.select({
      id: poLines.id, productId: poLines.productId, hsCode: poLines.hsCode,
      qty: poLines.qty, uom: poLines.uom, unitPrice: poLines.unitPrice,
      totalPrice: poLines.totalPrice, productName: products.name,
    }).from(poLines)
      .leftJoin(products, eq(products.id, poLines.productId))
      .where(eq(poLines.poId, sp.poId));
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New Commercial Invoice</h1>
        <p className="text-sm text-slate-500">Record the supplier's CI received with shipping documents</p>
      </div>
      <CommercialInvoiceForm
        purchaseOrders={allPOs}
        suppliers={allSuppliers}
        proformaInvoices={allPIs}
        letterOfCredits={allLCs}
        shipments={allShipments}
        preloadedPoId={sp.poId}
        preloadedPiId={sp.piId}
        preloadedLines={preloadedLines}
      />
    </div>
  );
}
