import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { purchaseOrders, shipments, goodsDeclarations, shipmentContainers, letterOfCredits, stockLedger, products, warehouses, suppliers } from '@/db/schema';
import { eq, isNotNull, ne, notInArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalyticsDashboard } from '@/components/reports/analytics-dashboard';

export const revalidate = 0;

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [
    monthlyImport,
    supplierDiversity,
    topProducts,
    stockByWarehouse,
    dutyMonthly,
    lcExposure,
    demurrageByMonth,
  ] = await Promise.all([
    // 1. Monthly CIF value (last 12 months)
    tdb.select({
      month: sql<string>`TO_CHAR(${purchaseOrders.createdAt}, 'YYYY-MM')`,
      cifUsd: sql<string>`SUM(${purchaseOrders.cifValueUsd})`,
      cifPkr: sql<string>`SUM(${purchaseOrders.cifValuePkr})`,
      poCount: sql<number>`COUNT(*)::int`,
    }).from(purchaseOrders)
      .where(sql`${purchaseOrders.createdAt} >= NOW() - INTERVAL '12 months'`)
      .groupBy(sql`TO_CHAR(${purchaseOrders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${purchaseOrders.createdAt}, 'YYYY-MM')`),

    // 2. Supplier diversity by country
    tdb.select({
      country: suppliers.country,
      count: sql<number>`COUNT(DISTINCT ${purchaseOrders.id})::int`,
      value: sql<string>`SUM(${purchaseOrders.cifValueUsd})`,
    }).from(purchaseOrders)
      .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(isNotNull(suppliers.country))
      .groupBy(suppliers.country)
      .orderBy(sql`SUM(${purchaseOrders.cifValueUsd}) DESC`),

    // 3. Top 10 products by import quantity
    tdb.select({
      productName: products.name,
      productCode: products.code,
      totalQty: sql<string>`SUM(${stockLedger.qty})`,
      uom: stockLedger.uom,
    }).from(stockLedger)
      .innerJoin(products, eq(products.id, stockLedger.productId))
      .where(eq(stockLedger.movementType, 'grn_in'))
      .groupBy(products.id, products.name, products.code, stockLedger.uom)
      .orderBy(sql`SUM(${stockLedger.qty}) DESC`)
      .limit(10),

    // 4. Stock value by warehouse (using qty as proxy — no unit cost yet)
    tdb.select({
      warehouseName: warehouses.name,
      productCount: sql<number>`COUNT(DISTINCT ${stockLedger.productId})::int`,
      totalQty: sql<string>`SUM(${stockLedger.qty})`,
    }).from(stockLedger)
      .innerJoin(warehouses, eq(warehouses.id, stockLedger.warehouseId))
      .groupBy(warehouses.id, warehouses.name)
      .having(sql`SUM(${stockLedger.qty}) > 0`),

    // 5. Monthly duty payments (last 12 months)
    tdb.select({
      month: sql<string>`TO_CHAR(${goodsDeclarations.psidDate}::date, 'YYYY-MM')`,
      totalDuty: sql<string>`SUM(${goodsDeclarations.totalCustomsDutyPkr})`,
      totalSt: sql<string>`SUM(${goodsDeclarations.totalSalesTaxPkr})`,
      totalPayable: sql<string>`SUM(${goodsDeclarations.totalPayablePkr})`,
    }).from(goodsDeclarations)
      .where(sql`${goodsDeclarations.psidDate} IS NOT NULL AND ${goodsDeclarations.psidDate}::date >= NOW()::date - INTERVAL '12 months'`)
      .groupBy(sql`TO_CHAR(${goodsDeclarations.psidDate}::date, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${goodsDeclarations.psidDate}::date, 'YYYY-MM')`),

    // 6. Open LC exposure
    tdb.select({
      currency: letterOfCredits.currency,
      totalOpen: sql<string>`SUM(${letterOfCredits.lcAmount})`,
      count: sql<number>`COUNT(*)::int`,
    }).from(letterOfCredits)
      .where(notInArray(letterOfCredits.status, ['retired', 'expired', 'cancelled']))
      .groupBy(letterOfCredits.currency),

    // 7. Demurrage by month
    tdb.select({
      month: sql<string>`TO_CHAR(${shipmentContainers.portArrivalDate}::date, 'YYYY-MM')`,
      totalDemurrage: sql<string>`SUM(${shipmentContainers.demurragePaidAmount})`,
      count: sql<number>`COUNT(CASE WHEN ${shipmentContainers.demurragePaidAmount} IS NOT NULL THEN 1 END)::int`,
    }).from(shipmentContainers)
      .where(isNotNull(shipmentContainers.portArrivalDate))
      .groupBy(sql`TO_CHAR(${shipmentContainers.portArrivalDate}::date, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${shipmentContainers.portArrivalDate}::date, 'YYYY-MM')`),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Interactive charts for import operations</p>
        </div>
      </div>
      <AnalyticsDashboard
        monthlyImport={monthlyImport}
        supplierDiversity={supplierDiversity}
        topProducts={topProducts}
        stockByWarehouse={stockByWarehouse}
        dutyMonthly={dutyMonthly}
        lcExposure={lcExposure}
        demurrageByMonth={demurrageByMonth}
      />
    </div>
  );
}
