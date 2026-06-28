import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { products, warehouses, stockLocations, shipments, goodsDeclarations, purchaseOrders, poLines } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { GrnForm } from '@/components/grn/grn-form';

export default async function NewGrnPage({ searchParams }: { searchParams: Promise<{ shipment?: string; gd?: string; po?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { shipment: initialShipmentId, gd: initialGdId, po: initialPoId } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allProducts, allWarehouses, allLocations, arrivedShipments, clearedGds, confirmedPos, posLines] = await Promise.all([
    tdb.select({ id: products.id, code: products.code, name: products.name, hsCode: products.hsCode, uom: products.uom })
      .from(products).where(eq(products.isActive, true)).orderBy(products.name),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.isActive, true)),
    tdb.select({ id: stockLocations.id, warehouseId: stockLocations.warehouseId, name: stockLocations.name, locationType: stockLocations.locationType })
      .from(stockLocations).where(eq(stockLocations.isActive, true)),
    tdb.select({ id: shipments.id, shipmentNo: shipments.shipmentNo })
      .from(shipments).where(inArray(shipments.status, ['customs_cleared', 'grn_done'])),
    tdb.select({ id: goodsDeclarations.id, gdNo: goodsDeclarations.gdNo })
      .from(goodsDeclarations).where(inArray(goodsDeclarations.status, ['duty_paid', 'cleared'])),
    tdb.select({ id: purchaseOrders.id, poNo: purchaseOrders.poNo })
      .from(purchaseOrders).where(inArray(purchaseOrders.status, ['confirmed', 'lc_requested', 'lc_opened', 'goods_dispatched', 'fully_received'])),
    tdb.select({ poId: poLines.poId, productId: poLines.productId, qty: poLines.qty, uom: poLines.uom }).from(poLines),
  ]);

  // Attach lines to POs
  const posWithLines = confirmedPos.map((po) => ({
    ...po,
    lines: posLines.filter((l) => l.poId === po.id).map((l) => ({ productId: l.productId, qty: l.qty, uom: l.uom })),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/grn">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Goods Receipt Note</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record physical receipt of goods at warehouse</p>
        </div>
      </div>
      <GrnForm
        products={allProducts}
        warehouses={allWarehouses}
        locations={allLocations}
        shipments={arrivedShipments}
        gds={clearedGds}
        pos={posWithLines}
        initialShipmentId={initialShipmentId}
        initialGdId={initialGdId}
        initialPoId={initialPoId}
      />
    </div>
  );
}
