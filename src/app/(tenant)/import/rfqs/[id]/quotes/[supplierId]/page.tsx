import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { rfqs, rfqLines, rfqSuppliers, supplierQuotes, products, suppliers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { QuoteEntryForm } from '@/components/rfq/quote-entry-form';

export default async function QuoteEntryPage({
  params,
}: {
  params: Promise<{ id: string; supplierId: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id: rfqId, supplierId: rfqSupplierId } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[rfq], [rfqSupplierRow]] = await Promise.all([
    tdb.select().from(rfqs).where(eq(rfqs.id, rfqId)).limit(1),
    tdb.select({ rfqSupplier: rfqSuppliers, supplier: suppliers })
      .from(rfqSuppliers)
      .leftJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
      .where(and(eq(rfqSuppliers.id, rfqSupplierId), eq(rfqSuppliers.rfqId, rfqId)))
      .limit(1),
  ]);

  if (!rfq || !rfqSupplierRow) notFound();

  const [lines, existingQuotes] = await Promise.all([
    tdb.select({ line: rfqLines, product: products })
      .from(rfqLines)
      .leftJoin(products, eq(rfqLines.productId, products.id))
      .where(eq(rfqLines.rfqId, rfqId))
      .orderBy(rfqLines.sortOrder),
    tdb.select().from(supplierQuotes)
      .where(eq(supplierQuotes.rfqSupplierId, rfqSupplierId)),
  ]);

  // Map existing quotes by lineId
  const existingByLine: Record<string, typeof supplierQuotes.$inferSelect> = {};
  for (const q of existingQuotes) {
    existingByLine[q.rfqLineId] = q;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/import/rfqs/${rfqId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {existingQuotes.length > 0 ? 'Edit Quotes' : 'Enter Quotes'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-mono">{rfq.rfqNo}</span> · {rfqSupplierRow.supplier?.name ?? '—'}
          </p>
        </div>
      </div>

      <QuoteEntryForm
        rfqId={rfqId}
        rfqSupplierId={rfqSupplierId}
        currency={rfq.currency ?? 'USD'}
        lines={lines.map(({ line, product }) => ({
          id: line.id,
          productName: product?.name ?? line.productId,
          qty: String(line.qty),
          uom: line.uom ?? product?.uom ?? '',
          specGrade: line.specGrade ?? '',
          targetPrice: line.targetPrice ?? undefined,
          existing: existingByLine[line.id] ?? undefined,
        }))}
      />
    </div>
  );
}
