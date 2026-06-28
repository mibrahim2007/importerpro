import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { commercialInvoices, purchaseOrders, suppliers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, FileCheck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const revalidate = 0;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  received:   { label: 'Received',   cls: 'bg-blue-100 text-blue-700' },
  verified:   { label: 'Verified',   cls: 'bg-purple-100 text-purple-700' },
  matched:    { label: 'Matched ✓',  cls: 'bg-green-100 text-green-700' },
  discrepant: { label: 'Discrepant', cls: 'bg-red-100 text-red-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-slate-100 text-slate-500' },
};

const MATCH_BADGE: Record<string, { label: string; cls: string }> = {
  pending:          { label: 'Pending',        cls: 'bg-slate-100 text-slate-500' },
  matched:          { label: 'Matched',         cls: 'bg-green-100 text-green-700' },
  minor_variance:   { label: 'Minor Variance',  cls: 'bg-amber-100 text-amber-700' },
  discrepant:       { label: 'Discrepant',      cls: 'bg-red-100 text-red-700' },
};

export default async function CommercialListPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      id: commercialInvoices.id,
      ciNo: commercialInvoices.ciNo,
      ciDate: commercialInvoices.ciDate,
      currency: commercialInvoices.currency,
      totalCifValue: commercialInvoices.totalCifValue,
      totalCifPkr: commercialInvoices.totalCifPkr,
      status: commercialInvoices.status,
      matchStatus: commercialInvoices.matchStatus,
      incoterms: commercialInvoices.incoterms,
      createdAt: commercialInvoices.createdAt,
      supplierName: suppliers.name,
      poNo: purchaseOrders.poNo,
    })
    .from(commercialInvoices)
    .leftJoin(suppliers, eq(suppliers.id, commercialInvoices.supplierId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, commercialInvoices.poId))
    .orderBy(desc(commercialInvoices.createdAt));

  const counts = {
    total: rows.length,
    discrepant: rows.filter((r) => r.matchStatus === 'discrepant').length,
    matched: rows.filter((r) => r.matchStatus === 'matched').length,
    pending: rows.filter((r) => r.matchStatus === 'pending' || r.matchStatus === 'minor_variance').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Commercial Invoices</h1>
          <p className="text-sm text-slate-500">Supplier CIs with PO/LC matching engine</p>
        </div>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/import/commercial/new"><Plus className="h-4 w-4 mr-1.5" />New Commercial Invoice</Link>
        </Button>
      </div>

      {counts.discrepant > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-2 items-center text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <strong>{counts.discrepant}</strong> commercial invoice{counts.discrepant !== 1 ? 's' : ''} with LC violations — review discrepancies before customs clearance.
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total CIs', value: counts.total, Icon: FileCheck, color: 'text-slate-700' },
          { label: 'Matched', value: counts.matched, Icon: CheckCircle2, color: 'text-green-700' },
          { label: 'Discrepant', value: counts.discrepant, Icon: AlertTriangle, color: counts.discrepant > 0 ? 'text-red-600' : 'text-slate-400' },
          { label: 'Pending Review', value: counts.pending, Icon: XCircle, color: 'text-amber-600' },
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
            <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No commercial invoices yet</p>
            <p className="text-xs mt-1">Record a CI when shipping documents arrive from the supplier</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['CI No (Supplier Ref)', 'Date', 'Supplier', 'Linked PO', 'CIF Value', 'CIF PKR', 'Match Result', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const statusBadge = STATUS_BADGE[r.status ?? 'received'];
                const matchBadge = MATCH_BADGE[r.matchStatus ?? 'pending'];
                return (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/import/commercial/${r.id}`} className="font-mono text-teal-700 font-semibold hover:underline">{r.ciNo}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.ciDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{r.supplierName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-500">{r.poNo ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {r.currency} {parseFloat(String(r.totalCifValue || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      PKR {parseFloat(String(r.totalCifPkr || '0')).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${matchBadge.cls}`}>{matchBadge.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
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
