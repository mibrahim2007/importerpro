import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { rfqs, rfqLines, rfqSuppliers, supplierQuotes, suppliers, products } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Star } from 'lucide-react';
import { PoForm, type PoLine } from '@/components/po/po-form';

export default async function NewPoFromRfqPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ supplier?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id: rfqId } = await params;
  const { supplier: selectedRfqSupplierId } = await searchParams;

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[rfq], lines, rfqSupplierRows] = await Promise.all([
    tdb.select().from(rfqs).where(eq(rfqs.id, rfqId)).limit(1),
    tdb.select({ line: rfqLines, product: products })
      .from(rfqLines)
      .leftJoin(products, eq(rfqLines.productId, products.id))
      .where(eq(rfqLines.rfqId, rfqId))
      .orderBy(rfqLines.sortOrder),
    tdb.select({ rfqSupplier: rfqSuppliers, supplier: suppliers })
      .from(rfqSuppliers)
      .leftJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
      .where(eq(rfqSuppliers.rfqId, rfqId)),
  ]);

  if (!rfq) notFound();

  // Fetch all quotes
  const rfqSupplierIds = rfqSupplierRows.map((r) => r.rfqSupplier.id);
  const allQuotes = rfqSupplierIds.length > 0
    ? (await Promise.all(rfqSupplierIds.map((sid) =>
        tdb.select().from(supplierQuotes).where(eq(supplierQuotes.rfqSupplierId, sid))
      ))).flat()
    : [];

  // If supplier not selected yet, show selection UI
  if (!selectedRfqSupplierId) {
    // Compute totals per supplier
    const supplierTotals = rfqSupplierRows.map(({ rfqSupplier, supplier }) => {
      const quotes = allQuotes.filter((q) => q.rfqSupplierId === rfqSupplier.id);
      const total = quotes.reduce((sum, q) => {
        const line = lines.find((l) => l.line.id === q.rfqLineId);
        return sum + Number(q.unitPrice) * Number(line?.line.qty ?? 0);
      }, 0);
      const recommended = quotes.some((q) => q.isRecommended);
      return { rfqSupplier, supplier, total, quoteCount: quotes.length, recommended };
    });

    return (
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/import/rfqs/${rfqId}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Select Supplier</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">from {rfq.rfqNo}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">Choose which supplier's quotes to use for this Purchase Order:</p>
        <div className="space-y-3">
          {supplierTotals.map(({ rfqSupplier, supplier, total, quoteCount, recommended }) => (
            <Link
              key={rfqSupplier.id}
              href={`/import/rfqs/${rfqId}/po/new?supplier=${rfqSupplier.id}`}
            >
              <Card className="cursor-pointer hover:shadow-md hover:border-teal-400 transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{supplier?.name ?? '—'}</p>
                      {recommended && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" /> Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{quoteCount} of {lines.length} lines quoted</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-500">{rfq.currency ?? 'USD'}</p>
                    <p className="text-lg font-bold text-teal-700">
                      {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {rfqSupplierRows.every((r) => allQuotes.filter((q) => q.rfqSupplierId === r.rfqSupplier.id).length === 0) && (
            <p className="text-sm text-slate-400 text-center py-8">No quotes recorded yet. Enter supplier quotes first.</p>
          )}
        </div>
      </div>
    );
  }

  // Supplier selected — build pre-filled form
  const rfqSupplierRow = rfqSupplierRows.find((r) => r.rfqSupplier.id === selectedRfqSupplierId);
  if (!rfqSupplierRow) notFound();

  const supplierQuoteMap: Record<string, typeof supplierQuotes.$inferSelect> = {};
  for (const q of allQuotes.filter((q) => q.rfqSupplierId === selectedRfqSupplierId)) {
    supplierQuoteMap[q.rfqLineId] = q;
  }

  const prefilledLines: PoLine[] = lines
    .filter(({ line }) => supplierQuoteMap[line.id])
    .map(({ line, product }) => ({
      productId: line.productId,
      productName: product?.name ?? line.productId,
      hsCode: product?.hsCode ?? '',
      qty: Number(line.qty),
      uom: line.uom ?? product?.uom ?? 'MT',
      unitPrice: Number(supplierQuoteMap[line.id]!.unitPrice),
    }));

  const [allSuppliers, allProducts] = await Promise.all([
    tdb.select({ id: suppliers.id, name: suppliers.name, code: suppliers.code })
      .from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    tdb.select({ id: products.id, name: products.name, code: products.code, hsCode: products.hsCode, uom: products.uom })
      .from(products).where(eq(products.isActive, true)).orderBy(products.name),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/import/rfqs/${rfqId}/po/new`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-mono">
            {rfq.rfqNo} · {rfqSupplierRow.supplier?.name}
          </p>
        </div>
      </div>
      <PoForm
        suppliers={allSuppliers}
        products={allProducts}
        rfqId={rfqId}
        indentId={rfq.indentId ?? undefined}
        initialSupplierId={rfqSupplierRow.rfqSupplier.supplierId}
        initialLines={prefilledLines}
        initialIncoterms={rfq.incoterms ?? 'CIF'}
        initialCurrency={rfq.currency ?? 'USD'}
        initialPaymentTerms={rfq.paymentTerms ?? 'lc_sight'}
        initialPortOfDischarge={rfq.portOfDischarge ?? ''}
        initialExchangeRate={rfq.exchangeRate ? String(rfq.exchangeRate) : ''}
      />
    </div>
  );
}
