import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { rfqs, rfqLines, rfqSuppliers, supplierQuotes, products, suppliers, indents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Send, Star } from 'lucide-react';
import { RfqStatusActions } from '@/components/rfq/rfq-status-actions';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  quotes_received: 'bg-amber-100 text-amber-700',
  comparison_done: 'bg-indigo-100 text-indigo-700',
  po_created: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

const SUPPLIER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  quoted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
};

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rfq] = await tdb.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
  if (!rfq) notFound();

  const [lines, rfqSupplierRows, indent] = await Promise.all([
    tdb.select({ line: rfqLines, product: products })
      .from(rfqLines)
      .leftJoin(products, eq(rfqLines.productId, products.id))
      .where(eq(rfqLines.rfqId, id))
      .orderBy(rfqLines.sortOrder),
    tdb.select({ rfqSupplier: rfqSuppliers, supplier: suppliers })
      .from(rfqSuppliers)
      .leftJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
      .where(eq(rfqSuppliers.rfqId, id)),
    rfq.indentId
      ? tdb.select().from(indents).where(eq(indents.id, rfq.indentId)).limit(1)
      : Promise.resolve([]),
  ]);

  // Fetch all quotes for this RFQ's suppliers
  const rfqSupplierIds = rfqSupplierRows.map((r) => r.rfqSupplier.id);
  let allQuotes: (typeof supplierQuotes.$inferSelect)[] = [];
  if (rfqSupplierIds.length > 0) {
    // Get quotes for all rfqSuppliers belonging to this RFQ
    const quoteResults = await Promise.all(
      rfqSupplierIds.map((sid) =>
        tdb.select().from(supplierQuotes).where(eq(supplierQuotes.rfqSupplierId, sid))
      )
    );
    allQuotes = quoteResults.flat();
  }

  // Build the comparison matrix:
  // quoteMap[rfqLineId][rfqSupplierId] = quote
  const quoteMap: Record<string, Record<string, typeof supplierQuotes.$inferSelect>> = {};
  for (const quote of allQuotes) {
    if (!quoteMap[quote.rfqLineId]) quoteMap[quote.rfqLineId] = {};
    quoteMap[quote.rfqLineId][quote.rfqSupplierId] = quote;
  }

  // Find lowest price per line (for highlighting)
  const lowestPerLine: Record<string, number> = {};
  for (const lineData of lines) {
    const lineId = lineData.line.id;
    const prices = rfqSupplierRows
      .map((r) => quoteMap[lineId]?.[r.rfqSupplier.id])
      .filter(Boolean)
      .map((q) => Number(q!.unitPrice));
    if (prices.length > 0) lowestPerLine[lineId] = Math.min(...prices);
  }

  const hasAnyQuotes = allQuotes.length > 0;
  const canApprove = ['tenant_admin', 'procurement_manager'].includes(session.user.role ?? '');

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/import/rfqs">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-mono font-bold text-slate-900">{rfq.rfqNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[rfq.status ?? 'draft']}`}>
                {(rfq.status ?? 'draft').replace(/_/g, ' ')}
              </span>
            </div>
            {(indent as any)[0] && (
              <p className="text-sm text-slate-400 mt-0.5">
                <Link href={`/import/indents/${rfq.indentId}`} className="hover:text-teal-600 font-mono">
                  {(indent as any)[0].indentNo}
                </Link>
              </p>
            )}
          </div>
        </div>
        <RfqStatusActions rfqId={id} status={rfq.status ?? 'draft'} canApprove={canApprove} />
      </div>

      {/* Terms summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Incoterms', value: rfq.incoterms ?? '—' },
          { label: 'Currency', value: rfq.currency ?? '—' },
          { label: 'Port of Discharge', value: rfq.portOfDischarge ?? '—' },
          { label: 'Valid Until', value: rfq.validUntil ? new Date(rfq.validUntil).toLocaleDateString('en-PK') : '—' },
        ].map((item) => (
          <Card key={item.label} className="py-3 px-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{item.label}</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">{item.value}</p>
          </Card>
        ))}
      </div>

      {/* Suppliers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Invited Suppliers</CardTitle>
            {rfq.status !== 'cancelled' && rfq.status !== 'po_created' && (
              <Link href={`/import/rfqs/${id}/quotes/new`}>
                <Button size="sm" variant="outline">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Record Quotes
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Supplier</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Sent At</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Quote Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Quotes</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rfqSupplierRows.map(({ rfqSupplier, supplier }) => {
                const quoteCount = allQuotes.filter((q) => q.rfqSupplierId === rfqSupplier.id).length;
                return (
                  <tr key={rfqSupplier.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize text-xs">{supplier?.supplierType?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {rfqSupplier.sentAt ? new Date(rfqSupplier.sentAt).toLocaleDateString('en-PK') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SUPPLIER_STATUS_COLORS[rfqSupplier.status ?? 'pending']}`}>
                        {rfqSupplier.status ?? 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{quoteCount} of {lines.length}</td>
                    <td className="px-4 py-3">
                      <Link href={`/import/rfqs/${id}/quotes/${rfqSupplier.id}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          {quoteCount > 0 ? 'Edit Quotes' : 'Enter Quotes'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Quote Comparison Matrix */}
      {hasAnyQuotes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Price Comparison Matrix</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 min-w-48">Product</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-24">Qty</th>
                    {rfqSupplierRows.map(({ rfqSupplier, supplier }) => (
                      <th key={rfqSupplier.id} className="text-center px-4 py-2.5 font-medium text-slate-600 min-w-40">
                        <div>{supplier?.name ?? '—'}</div>
                        <div className="text-xs font-normal text-slate-400">{rfq.currency ?? 'USD'}/unit</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ line, product }) => (
                    <tr key={line.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{product?.name ?? line.productId}</p>
                        {line.specGrade && <p className="text-xs text-slate-400">{line.specGrade}</p>}
                        {line.targetPrice && (
                          <p className="text-xs text-slate-400">Target: ${Number(line.targetPrice).toFixed(2)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{Number(line.qty).toLocaleString()} {line.uom ?? ''}</td>
                      {rfqSupplierRows.map(({ rfqSupplier }) => {
                        const quote = quoteMap[line.id]?.[rfqSupplier.id];
                        const price = quote ? Number(quote.unitPrice) : null;
                        const isLowest = price !== null && lowestPerLine[line.id] === price;
                        return (
                          <td key={rfqSupplier.id} className="px-4 py-3 text-center">
                            {quote ? (
                              <div>
                                <span className={`text-base font-semibold ${isLowest ? 'text-green-700' : 'text-slate-800'}`}>
                                  {isLowest && <span className="text-green-500 mr-1">↓</span>}
                                  ${price!.toFixed(2)}
                                </span>
                                {quote.leadTimeDays && (
                                  <p className="text-xs text-slate-400 mt-0.5">{quote.leadTimeDays}d lead</p>
                                )}
                                {quote.isRecommended && (
                                  <div className="flex items-center justify-center gap-0.5 text-xs text-amber-600 mt-0.5">
                                    <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" /> Recommended
                                  </div>
                                )}
                                {quote.portOfLoading && (
                                  <p className="text-xs text-slate-400">{quote.portOfLoading}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">No quote</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action: Create PO from comparison */}
      {hasAnyQuotes && rfq.status !== 'cancelled' && rfq.status !== 'po_created' && (
        <div className="flex justify-end">
          <Link href={`/import/rfqs/${id}/po/new`}>
            <Button className="bg-teal-600 hover:bg-teal-700">
              Create Purchase Order →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
