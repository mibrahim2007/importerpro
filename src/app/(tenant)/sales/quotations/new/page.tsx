import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers, products, salesInquiries, customerAddresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { QuotationForm } from '@/components/sales/quotation-form';

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ inquiryId?: string; customerId?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { inquiryId, customerId } = await searchParams;

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [cList, pList] = await Promise.all([
    tdb.select({
      id: customers.id, name: customers.name, code: customers.code,
      salesTaxCategory: customers.salesTaxCategory, whtRatePct: customers.whtRatePct,
      paymentTerms: customers.paymentTerms,
    }).from(customers).where(eq(customers.isActive, true)),

    tdb.select({ id: products.id, name: products.name, code: products.code, uom: products.uom })
      .from(products).where(eq(products.isActive, true)),
  ]);

  // Pre-populate from inquiry
  let inquiryLines: Array<{ productId: string; productName: string | null; tentativeQty: string | null; uom: string | null }> = [];
  if (inquiryId) {
    const { salesInquiryLines } = await import('@/db/schema');
    inquiryLines = await tdb.select({
      productId: salesInquiryLines.productId,
      productName: products.name,
      tentativeQty: salesInquiryLines.tentativeQty,
      uom: salesInquiryLines.uom,
    })
    .from(salesInquiryLines)
    .leftJoin(products, eq(products.id, salesInquiryLines.productId))
    .where(eq(salesInquiryLines.inquiryId, inquiryId));
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/sales/quotations"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-slate-900">New Sales Quotation</h1>
      </div>
      <QuotationForm
        customers={cList}
        products={pList}
        prefillCustomerId={customerId}
        prefillInquiryId={inquiryId}
        prefillLines={inquiryLines}
      />
    </div>
  );
}
