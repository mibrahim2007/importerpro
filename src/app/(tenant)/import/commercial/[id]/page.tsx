import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommercialActions } from '@/components/import/commercial-actions';

export const revalidate = 0;

async function getCi(tenantSlug: string, id: string) {
  const { getTenantDb } = await import('@/db');
  const { commercialInvoices, commercialInvoiceLines, purchaseOrders, suppliers, products } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const tdb = await getTenantDb(tenantSlug);

  const [ci] = await tdb.select({
    id: commercialInvoices.id, ciNo: commercialInvoices.ciNo, ciDate: commercialInvoices.ciDate,
    poId: commercialInvoices.poId, piId: commercialInvoices.piId, lcId: commercialInvoices.lcId,
    shipmentId: commercialInvoices.shipmentId,
    currency: commercialInvoices.currency, exchangeRate: commercialInvoices.exchangeRate,
    portOfLoading: commercialInvoices.portOfLoading, portOfDischarge: commercialInvoices.portOfDischarge,
    incoterms: commercialInvoices.incoterms, countryOfOrigin: commercialInvoices.countryOfOrigin,
    netWeightKg: commercialInvoices.netWeightKg, grossWeightKg: commercialInvoices.grossWeightKg,
    packageCount: commercialInvoices.packageCount, marksNumbers: commercialInvoices.marksNumbers,
    freightAmount: commercialInvoices.freightAmount, insuranceAmount: commercialInvoices.insuranceAmount,
    totalFobValue: commercialInvoices.totalFobValue, totalCifValue: commercialInvoices.totalCifValue,
    totalCifPkr: commercialInvoices.totalCifPkr,
    status: commercialInvoices.status, matchStatus: commercialInvoices.matchStatus,
    matchSummary: commercialInvoices.matchSummary,
    notes: commercialInvoices.notes, createdAt: commercialInvoices.createdAt,
    supplierName: suppliers.name, supplierCountry: suppliers.country,
    poNo: purchaseOrders.poNo,
  }).from(commercialInvoices)
    .leftJoin(suppliers, eq(suppliers.id, commercialInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, commercialInvoices.poId))
    .where(eq(commercialInvoices.id, id));

  if (!ci) return null;

  const lines = await tdb.select({
    id: commercialInvoiceLines.id,
    hsCode: commercialInvoiceLines.hsCode, description: commercialInvoiceLines.description,
    qty: commercialInvoiceLines.qty, uom: commercialInvoiceLines.uom,
    unitPrice: commercialInvoiceLines.unitPrice, totalValue: commercialInvoiceLines.totalValue,
    poQty: commercialInvoiceLines.poQty, poUnitPrice: commercialInvoiceLines.poUnitPrice,
    qtyVariancePct: commercialInvoiceLines.qtyVariancePct,
    priceVariancePct: commercialInvoiceLines.priceVariancePct,
    varianceFlag: commercialInvoiceLines.varianceFlag, sortOrder: commercialInvoiceLines.sortOrder,
    productName: products.name,
  }).from(commercialInvoiceLines)
    .leftJoin(products, eq(products.id, commercialInvoiceLines.productId))
    .where(eq(commercialInvoiceLines.ciId, id))
    .orderBy(commercialInvoiceLines.sortOrder);

  const parsedSummary = ci.matchSummary ? JSON.parse(ci.matchSummary as string) : null;
  return { ...ci, matchSummary: parsedSummary, lines };
}

const STATUS = {
  received:   { label: 'Received',    cls: 'bg-blue-100 text-blue-700' },
  verified:   { label: 'Verified',    cls: 'bg-purple-100 text-purple-700' },
  matched:    { label: 'Matched ✓',   cls: 'bg-green-100 text-green-700' },
  discrepant: { label: 'Discrepant',  cls: 'bg-red-100 text-red-700' },
  cancelled:  { label: 'Cancelled',   cls: 'bg-slate-100 text-slate-500' },
};
const MATCH = {
  matched:        { label: 'Matched',        cls: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
  minor_variance: { label: 'Minor Variance', cls: 'bg-amber-100 text-amber-700', Icon: Info },
  discrepant:     { label: 'Discrepant',     cls: 'bg-red-100 text-red-700', Icon: AlertTriangle },
  pending:        { label: 'Pending',        cls: 'bg-slate-100 text-slate-500', Icon: Info },
};

export default async function CommercialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const ci = await getCi(session.user.tenantSlug, id);
  if (!ci) redirect('/import/commercial');

  const statusBadge = STATUS[ci.status as keyof typeof STATUS] ?? STATUS.received;
  const matchInfo = MATCH[ci.matchStatus as keyof typeof MATCH] ?? MATCH.pending;
  const MatchIcon = matchInfo.Icon;

  const fmtVal = (v: string | null) => parseFloat(v ?? '0').toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtPkr = (v: string | null) => parseFloat(v ?? '0').toLocaleString('en-PK', { maximumFractionDigits: 0 });
  const fmtPct = (v: string | null) => {
    if (!v) return null;
    const n = parseFloat(v);
    return <span className={`text-xs ${Math.abs(n) > 10 || Math.abs(n) > 5 ? 'text-red-600 font-bold' : Math.abs(n) > 3 ? 'text-amber-600' : 'text-green-600'}`}>
      {n > 0 ? '+' : ''}{n.toFixed(1)}%
    </span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/commercial" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{ci.ciNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${matchInfo.cls}`}>
              <MatchIcon className="h-3 w-3" />{matchInfo.label}
            </span>
          </div>
          <p className="text-sm text-slate-500">{ci.supplierName} · {ci.ciDate} · <span className="font-mono">{ci.poNo}</span></p>
        </div>
      </div>

      {/* Discrepancy banner */}
      {ci.matchStatus === 'discrepant' && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>LC Violation Detected</strong> — This CI has discrepancies that exceed the allowed tolerance.
            Contact your bank and supplier to resolve before customs filing. Issue a LC discrepancy notice to supplier.
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Main content */}
        <div className="col-span-2 space-y-4">
          {/* CI Details */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Commercial Invoice Details</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: 'CI Reference', value: ci.ciNo },
                { label: 'CI Date', value: ci.ciDate },
                { label: 'Supplier', value: ci.supplierName ?? '—' },
                { label: 'Country', value: ci.supplierCountry ?? '—' },
                { label: 'Incoterms', value: ci.incoterms },
                { label: 'Currency', value: ci.currency },
                { label: 'Exchange Rate', value: `${parseFloat(String(ci.exchangeRate || '280'))} PKR` },
                { label: 'Country of Origin', value: ci.countryOfOrigin ?? '—' },
                { label: 'Port of Loading', value: ci.portOfLoading ?? '—' },
                { label: 'Port of Discharge', value: ci.portOfDischarge ?? '—' },
                { label: 'Net Weight', value: ci.netWeightKg ? `${ci.netWeightKg} KG` : '—' },
                { label: 'Gross Weight', value: ci.grossWeightKg ? `${ci.grossWeightKg} KG` : '—' },
                { label: 'Package Count', value: ci.packageCount ? String(ci.packageCount) : '—' },
                { label: 'Marks & Numbers', value: ci.marksNumbers ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="font-medium text-slate-700 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {/* Links */}
            <div className="flex gap-4 mt-3 pt-3 border-t text-xs">
              <Link href={`/import/purchase-orders`} className="text-teal-600 hover:underline">→ {ci.poNo}</Link>
              {ci.piId && <Link href={`/import/proforma/${ci.piId}`} className="text-teal-600 hover:underline">→ View Proforma Invoice</Link>}
              {ci.shipmentId && <Link href={`/import/shipments/${ci.shipmentId}`} className="text-teal-600 hover:underline">→ View Shipment</Link>}
            </div>
          </div>

          {/* Matching Engine Result */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Document Matching Engine — CI vs PO</h2>
                <p className="text-xs text-slate-400">
                  Tolerance: Qty ±3% minor / {'>'}±10% violation · Price ±1% minor / {'>'}±5% violation
                </p>
              </div>
              {ci.matchSummary && (
                <span className="text-xs text-slate-400">{ci.matchSummary.violations} violation{ci.matchSummary.violations !== 1 ? 's' : ''} of {ci.matchSummary.totalLines} lines</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['#', 'Description', 'HS Code', 'CI Qty', 'PO Qty', 'Δ Qty%', `CI Unit Price`, `PO Unit Price`, 'Δ Price%', `Total (${ci.currency})`, 'Result'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ci.lines.map((l, i) => (
                    <tr key={l.id} className={`border-b ${l.varianceFlag === 'violation' ? 'bg-red-50' : l.varianceFlag === 'minor' ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-700">{l.description}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{l.hsCode ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{parseFloat(String(l.qty)).toLocaleString('en-US', { maximumFractionDigits: 3 })}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400 text-xs">{l.poQty ? parseFloat(String(l.poQty)).toLocaleString('en-US', { maximumFractionDigits: 3 }) : '—'}</td>
                      <td className="px-3 py-2.5 text-right">{fmtPct(l.qtyVariancePct) ?? <span className="text-slate-400 text-xs">—</span>}</td>
                      <td className="px-3 py-2.5 text-right">{fmtVal(l.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400 text-xs">{l.poUnitPrice ? fmtVal(l.poUnitPrice) : '—'}</td>
                      <td className="px-3 py-2.5 text-right">{fmtPct(l.priceVariancePct) ?? <span className="text-slate-400 text-xs">—</span>}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{fmtVal(l.totalValue)}</td>
                      <td className="px-3 py-2.5">
                        {l.varianceFlag === 'violation' && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">VIOLATION</span>}
                        {l.varianceFlag === 'minor' && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">Minor</span>}
                        {l.varianceFlag === 'ok' && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t font-semibold">
                    <td colSpan={8} className="px-3 py-2.5 text-xs text-slate-500">FOB Sub-Total</td>
                    <td />
                    <td className="px-3 py-2.5 text-right">{fmtVal(ci.totalFobValue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">Financial Summary</h2>
            {[
              { label: `FOB (${ci.currency})`, value: fmtVal(ci.totalFobValue) },
              { label: `Freight (${ci.currency})`, value: fmtVal(ci.freightAmount) },
              { label: `Insurance (${ci.currency})`, value: fmtVal(ci.insuranceAmount) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm text-slate-400">
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 flex justify-between text-teal-400 font-bold">
              <span>CIF ({ci.currency})</span><span>{fmtVal(ci.totalCifValue)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg">
              <span>CIF PKR</span><span>PKR {fmtPkr(ci.totalCifPkr)}</span>
            </div>
          </div>

          {/* Match summary card */}
          <div className={`rounded-xl p-4 border ${matchInfo.cls}`}>
            <div className="flex items-center gap-2 mb-2">
              <MatchIcon className="h-4 w-4" />
              <p className="text-sm font-semibold">{matchInfo.label}</p>
            </div>
            {ci.matchSummary && (
              <div className="text-xs space-y-1">
                <p>Lines checked: {ci.matchSummary.totalLines}</p>
                <p>Violations: {ci.matchSummary.violations}</p>
                <p className="text-slate-500">Checked: {ci.matchSummary.checkedAt ? new Date(ci.matchSummary.checkedAt).toLocaleDateString() : '—'}</p>
              </div>
            )}
          </div>

          <CommercialActions ciId={ci.id} status={ci.status ?? 'received'} />

          {ci.notes && (
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-600">{ci.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
