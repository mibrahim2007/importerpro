import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import {
  customers, products, warehouses, branches,
  salesQuotations, salesQuotationLines, customerAddresses,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SalesOrderForm } from '@/components/sales/so-form';

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ quotationId?: string; customerId?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { quotationId, customerId: prefillCId } = await searchParams;

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [cList, pList, wList] = await Promise.all([
    tdb.select({
      id: customers.id, name: customers.name, code: customers.code,
      salesTaxCategory: customers.salesTaxCategory, whtRatePct: customers.whtRatePct,
      paymentTerms: customers.paymentTerms, creditLimitPkr: customers.creditLimitPkr,
    }).from(customers).where(eq(customers.isActive, true)),

    tdb.select({ id: products.id, name: products.name, code: products.code, uom: products.uom })
      .from(products).where(eq(products.isActive, true)),

    tdb.select({ id: warehouses.id, name: warehouses.name, branchId: warehouses.branchId })
      .from(warehouses).where(eq(warehouses.isActive, true)),
  ]);

  // Pre-populate from quotation
  let prefillLines: any[] = [];
  let prefillCustomerId = prefillCId ?? '';
  let prefillPaymentTerms = 'net_30';
  let prefillQuotationNo = '';

  if (quotationId) {
    const [[qt], qtLines] = await Promise.all([
      tdb.select({
        customerId: salesQuotations.customerId,
        paymentTerms: salesQuotations.paymentTerms,
        quotationNo: salesQuotations.quotationNo,
      }).from(salesQuotations).where(eq(salesQuotations.id, quotationId)).limit(1),

      tdb.select({
        productId: salesQuotationLines.productId,
        qty: salesQuotationLines.qty, uom: salesQuotationLines.uom,
        unitPricePkr: salesQuotationLines.unitPricePkr,
        discountPct: salesQuotationLines.discountPct,
        salesTaxPct: salesQuotationLines.salesTaxPct,
        productName: products.name, productCode: products.code,
      })
      .from(salesQuotationLines)
      .leftJoin(products, eq(products.id, salesQuotationLines.productId))
      .where(eq(salesQuotationLines.quotationId, quotationId))
      .orderBy(salesQuotationLines.sortOrder),
    ]);

    if (qt) {
      prefillCustomerId = qt.customerId ?? '';
      prefillPaymentTerms = qt.paymentTerms ?? 'net_30';
      prefillQuotationNo = qt.quotationNo ?? '';
      prefillLines = qtLines.map((l) => ({
        productId: l.productId,
        orderedQty: l.qty,
        uom: l.uom,
        unitPricePkr: l.unitPricePkr,
        discountPct: l.discountPct,
        salesTaxPct: l.salesTaxPct,
        productName: l.productName,
        productCode: l.productCode,
      }));
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/sales/orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Sales Order</h1>
          {prefillQuotationNo && <p className="text-sm text-slate-400">From quotation {prefillQuotationNo}</p>}
        </div>
      </div>
      <SalesOrderForm
        customers={cList}
        products={pList}
        warehouses={wList}
        prefillCustomerId={prefillCustomerId}
        prefillQuotationId={quotationId}
        prefillLines={prefillLines}
        prefillPaymentTerms={prefillPaymentTerms}
      />
    </div>
  );
}
