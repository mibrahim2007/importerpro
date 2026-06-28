import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { proformaInvoices, purchaseOrders, suppliers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, FileText, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const revalidate = 0;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Draft',      cls: 'bg-slate-100 text-slate-600' },
  received:   { label: 'Received',   cls: 'bg-blue-100 text-blue-700' },
  accepted:   { label: 'Accepted',   cls: 'bg-green-100 text-green-700' },
  superseded: { label: 'Superseded', cls: 'bg-amber-100 text-amber-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700' },
};

export default async function ProformaListPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: proformaInvoices.id,
      piNo: proformaInvoices.piNo,
      piDate: proformaInvoices.piDate,
      currency: proformaInvoices.currency,
      totalCifValue: proformaInvoices.totalCifValue,
      totalCifPkr: proformaInvoices.totalCifPkr,
      status: proformaInvoices.status,
      validityDate: proformaInvoices.validityDate,
      estimatedShipDate: proformaInvoices.estimatedShipDate,
      incoterms: proformaInvoices.incoterms,
      supplierName: suppliers.name,
      poNo: purchaseOrders.poNo,
    })
    .from(proformaInvoices)
    .leftJoin(suppliers, eq(suppliers.id, proformaInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, proformaInvoices.poId))
    .orderBy(desc(proformaInvoices.createdAt));

  const today = new Date().toISOString().split('T')[0];
  const counts = {
    total: rows.length,
    received: rows.filter((r) => r.status === 'received').length,
    accepted: rows.filter((r) => r.status === 'accepted').length,
    expiringSoon: rows.filter((r) => r.validityDate && r.validityDate <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] && r.status === 'received').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Proforma Invoices</h1>
          <p className="text-sm text-slate-500">Supplier PIs received before shipment</p>
        </div>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/import/proforma/new"><Plus className="h-4 w-4 mr-1.5" />New Proforma</Link>
        </Button>
      </div>

      {counts.expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2 items-center text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <strong>{counts.expiringSoon}</strong> PI{counts.expiringSoon !== 1 ? 's' : ''} expiring within 7 days — review and accept before validity lapses.
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total PIs', value: counts.total, Icon: FileText, color: 'text-slate-700' },
          { label: 'Received', value: counts.received, Icon: Clock, color: 'text-blue-700' },
          { label: 'Accepted', value: counts.accepted, Icon: CheckCircle, color: 'text-green-700' },
          { label: 'Expiring ≤7d', value: counts.expiringSoon, Icon: AlertTriangle, color: counts.expiringSoon > 0 ? 'text-amber-600' : 'text-slate-400' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-white border rounded-xl p-4 flex items-center gap-3">
            <Icon className={`h-8 w-8 ${color} opacity-80`} />
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No proforma invoices yet</p>
            <p className="text-xs mt-1">Create one after receiving a PI from your supplier</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['PI No (Supplier Ref)', 'Date', 'Supplier', 'Linked PO', 'Incoterms', 'CIF Value', 'Validity', 'Est. Ship', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = STATUS_BADGE[r.status ?? 'draft'];
                const isExpiring = r.validityDate && r.validityDate <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] && r.status === 'received';
                return (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/import/proforma/${r.id}`} className="font-mono text-teal-700 font-semibold hover:underline">{r.piNo}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.piDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{r.supplierName ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.poNo ? <Link href={`/import/purchase-orders/${r.poNo}`} className="text-xs text-teal-600 hover:underline font-mono">{r.poNo}</Link> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">{r.incoterms}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {r.currency} {parseFloat(String(r.totalCifValue || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-3 text-xs ${isExpiring ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
                      {r.validityDate ?? '—'}
                      {isExpiring && <span className="ml-1">⚠</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.estimatedShipDate ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
