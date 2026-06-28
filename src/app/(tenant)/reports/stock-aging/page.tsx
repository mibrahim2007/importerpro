import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockLedger, products, warehouses } from '@/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StockAgingClient } from '@/components/reports/stock-aging-client';

export const revalidate = 0;

export default async function StockAgingPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Stock by product/warehouse/lot with earliest receipt date
  const rows = await tdb
    .select({
      productId: stockLedger.productId,
      productName: products.name,
      productCode: products.code,
      productCategory: products.category,
      warehouseId: stockLedger.warehouseId,
      warehouseName: warehouses.name,
      lotBatchNo: stockLedger.lotBatchNo,
      uom: stockLedger.uom,
      totalQty: sql<string>`SUM(${stockLedger.qty})`,
      earliestReceipt: sql<string>`MIN(CASE WHEN ${stockLedger.movementType} = 'grn_in' THEN ${stockLedger.createdAt} ELSE NULL END)`,
    })
    .from(stockLedger)
    .innerJoin(products, eq(products.id, stockLedger.productId))
    .innerJoin(warehouses, eq(warehouses.id, stockLedger.warehouseId))
    .groupBy(stockLedger.productId, products.name, products.code, products.category, stockLedger.warehouseId, warehouses.name, stockLedger.lotBatchNo, stockLedger.uom)
    .having(gt(sql<number>`SUM(${stockLedger.qty})`, 0));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock Aging Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">On-hand stock by lot with age and warehouse location</p>
        </div>
      </div>
      <StockAgingClient rows={rows} />
    </div>
  );
}
