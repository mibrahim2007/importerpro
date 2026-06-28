import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProformaActions } from '@/components/import/proforma-actions';

export const revalidate = 0;

async function getPi(tenantSlug: string, id: string) {
  const { getTenantDb } = await import('@/db');
  const { proformaInvoices, proformaInvoiceLines, purchaseOrders, suppliers, products } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const tdb = await getTenantDb(tenantSlug);

  const [pi] = await tdb.select({
    id: proformaInvoices.id, piNo: proformaInvoices.piNo, piDate: proformaInvoices.piDate,
    poId: proformaInvoices.poId, currency: proformaInvoices.currency,
    exchangeRate: proformaInvoices.exchangeRate,
    validityDate: proformaInvoices.validityDate, estimatedShipDate: proformaInvoices.estimatedShipDate,
    portOfLoading: proformaInvoices.portOfLoading, portOfDischarge: proformaInvoices.portOfDischarge,
    incoterms: proformaInvoices.incoterms,
    freightAmount: proformaInvoices.freightAmount, insuranceAmount: proformaInvoices.insuranceAmount,
    totalFobValue: proformaInvoices.totalFobValue, totalCifValue: proformaInvoices.totalCifValue,
    totalCifPkr: proformaInvoices.totalCifPkr,
    status: proformaInvoices.status, attachmentUrl: proformaInvoices.attachmentUrl,
    notes: proformaInvoices.notes, createdAt: proformaInvoices.createdAt,
    supplierName: suppliers.name, supplierCountry: suppliers.country,
    poNo: purchaseOrders.poNo,
  }).from(proformaInvoices)
    .leftJoin(suppliers, eq(suppliers.id, proformaInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, proformaInvoices.poId))
    .where(eq(proformaInvoices.id, id));

  if (!pi) return null;

  const lines = await tdb.select({
    id: proformaInvoiceLines.id, hsCode: proformaInvoiceLines.hsCode,
    description: proformaInvoiceLines.description, qty: proformaInvoiceLines.qty,
    uom: proformaInvoiceLines.uom, unitPrice: proformaInvoiceLines.unitPrice,
    totalValue: proformaInvoiceLines.totalValue, sortOrder: proformaInvoiceLines.sortOrder,
    productName: products.name,
  }).from(proformaInvoiceLines)
    .leftJoin(products, eq(products.id, proformaInvoiceLines.productId))
    .where(eq(proformaInvoiceLines.piId, id))
    .orderBy(proformaInvoiceLines.sortOrder);

  return { ...pi, lines };
}

const STATUS = {
  draft:      { label: 'Draft',      cls: 'bg-slate-100 text-slate-600' },
  received:   { label: 'Received',   cls: 'bg-blue-100 text-blue-700' },
  accepted:   { label: 'Accepted',   cls: 'bg-green-100 text-green-700' },
  superseded: { label: 'Superseded', cls: 'bg-amber-100 text-amber-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700' },
};

export default async function ProformaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const pi = await getPi(session.user.tenantSlug, id);
  if (!pi) redirect('/import/proforma');

  const badge = STATUS[pi.status as keyof typeof STATUS] ?? STATUS.draft;
  const today = new Date().toISOString().split('T')[0];
  const isExpiring = pi.validityDate && pi.validityDate <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] && pi.status === 'received';

  const fmtVal = (v: string | null) => parseFloat(v ?? '0').toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtPkr = (v: string | null) => parseFloat(v ?? '0').toLocaleString('en-PK', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/proforma" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{pi.piNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="text-sm text-slate-500">{pi.supplierName} · {pi.piDate} · Linked to <Link href={`/import/purchase-orders`} className="text-teal-600 hover:underline">{pi.poNo}</Link></p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/import/commercial/new?poId=${pi.poId}&piId=${pi.id}`}>Create Commercial Invoice →</Link>
          </Button>
        </div>
      </div>

      {isExpiring && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          ⚠ Validity date {pi.validityDate} is approaching — accept or request revision from supplier.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* PI details */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">PI Details</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: 'PI Reference', value: pi.piNo },
                { label: 'PI Date', value: pi.piDate },
                { label: 'Supplier', value: pi.supplierName ?? '—' },
                { label: 'Country', value: pi.supplierCountry ?? '—' },
                { label: 'Incoterms', value: pi.incoterms },
                { label: 'Currency', value: pi.currency },
                { label: 'Exchange Rate', value: `${parseFloat(String(pi.exchangeRate || '280')).toLocaleString('en-PK')} PKR` },
                { label: 'Port of Loading', value: pi.portOfLoading ?? '—' },
                { label: 'Port of Discharge', value: pi.portOfDischarge ?? '—' },
                { label: 'Validity Date', value: pi.validityDate ?? '—' },
                { label: 'Est. Ship Date', value: pi.estimatedShipDate ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="font-medium text-slate-700 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {pi.notes && <p className="mt-3 text-sm text-slate-500 border-t pt-3">{pi.notes}</p>}
          </div>

          {/* Line items */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-slate-700">Line Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  {['#', 'Description', 'HS Code', 'Qty', 'UOM', `Unit Price (${pi.currency})`, `Total (${pi.currency})`].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pi.lines.map((l, i) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{l.description}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{l.hsCode ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">{parseFloat(String(l.qty)).toLocaleString('en-US', { maximumFractionDigits: 3 })}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{l.uom ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">{fmtVal(l.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmtVal(l.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t font-semibold">
                  <td colSpan={5} className="px-4 py-2.5 text-xs text-slate-500">FOB Value</td>
                  <td className="px-4 py-2.5 text-right" />
                  <td className="px-4 py-2.5 text-right">{fmtVal(pi.totalFobValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">Financial Summary</h2>
            {[
              { label: `FOB Value (${pi.currency})`, value: fmtVal(pi.totalFobValue) },
              { label: `Freight (${pi.currency})`, value: fmtVal(pi.freightAmount) },
              { label: `Insurance (${pi.currency})`, value: fmtVal(pi.insuranceAmount) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm text-slate-400">
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 flex justify-between text-teal-400 font-bold">
              <span>CIF ({pi.currency})</span><span>{fmtVal(pi.totalCifValue)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg">
              <span>CIF PKR</span><span>PKR {fmtPkr(pi.totalCifPkr)}</span>
            </div>
          </div>

          <ProformaActions piId={pi.id} status={pi.status ?? 'received'} />
        </div>
      </div>
    </div>
  );
}
