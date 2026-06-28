import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { letterOfCredits, suppliers, purchaseOrders } from '@/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft:                'bg-slate-100 text-slate-600',
  applied:              'bg-blue-100 text-blue-700',
  opened:               'bg-indigo-100 text-indigo-700',
  documents_presented:  'bg-amber-100 text-amber-700',
  under_scrutiny:       'bg-orange-100 text-orange-700',
  accepted:             'bg-teal-100 text-teal-700',
  retired:              'bg-green-100 text-green-700',
  expired:              'bg-red-100 text-red-500',
  cancelled:            'bg-slate-100 text-slate-400',
};

function expiryBadge(expiryDate: string | null) {
  if (!expiryDate) return null;
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: 'Expired', cls: 'text-red-600 font-bold' };
  if (days <= 7) return { label: `${days}d left`, cls: 'text-red-500 font-semibold flex items-center gap-1' };
  if (days <= 21) return { label: `${days}d left`, cls: 'text-amber-600 font-medium flex items-center gap-1' };
  return { label: `${days}d left`, cls: 'text-slate-400' };
}

export default async function LcPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const statusCounts = await tdb
    .select({ status: letterOfCredits.status, n: count() })
    .from(letterOfCredits).groupBy(letterOfCredits.status);
  const countMap = Object.fromEntries(statusCounts.map((r) => [r.status, r.n]));

  const rows = await tdb
    .select({
      lc: letterOfCredits,
      supplierName: suppliers.name,
      poNo: purchaseOrders.poNo,
    })
    .from(letterOfCredits)
    .leftJoin(suppliers, eq(letterOfCredits.supplierId, suppliers.id))
    .leftJoin(purchaseOrders, eq(letterOfCredits.poId, purchaseOrders.id))
    .orderBy(desc(letterOfCredits.createdAt))
    .limit(100);

  const activeStatuses = ['opened', 'documents_presented', 'under_scrutiny', 'accepted'];
  const activeLcs = rows.filter((r) => activeStatuses.includes(r.lc.status ?? ''));
  const expiringSoon = activeLcs.filter((r) => {
    if (!r.lc.expiryDate) return false;
    return differenceInDays(new Date(r.lc.expiryDate), new Date()) <= 14;
  });

  const summaryCards = [
    { label: 'Open LCs', count: (countMap['opened'] ?? 0) + (countMap['applied'] ?? 0), color: 'text-indigo-600' },
    { label: 'Under Scrutiny', count: (countMap['documents_presented'] ?? 0) + (countMap['under_scrutiny'] ?? 0), color: 'text-orange-600' },
    { label: 'Expiring ≤14d', count: expiringSoon.length, color: expiringSoon.length > 0 ? 'text-red-600' : 'text-slate-400' },
    { label: 'Retired', count: countMap['retired'] ?? 0, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Letters of Credit</h1>
          <p className="text-sm text-slate-500 mt-0.5">LC lifecycle, amendments &amp; document scrutiny</p>
        </div>
        <Link href="/import/lc/new">
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-1.5" /> Open LC
          </Button>
        </Link>
      </div>

      {expiringSoon.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-700">{expiringSoon.length} LC{expiringSoon.length > 1 ? 's' : ''} expiring within 14 days</p>
            <p className="text-red-500 mt-0.5">{expiringSoon.map((r) => r.lc.lcNo).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((s) => (
          <Card key={s.label} className="text-center py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">LC No</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Supplier</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">PO</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Type</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Issuing Bank</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Expiry</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No LCs yet.{' '}
                      <Link href="/import/lc/new" className="text-teal-600 hover:underline">Open your first LC →</Link>
                    </td>
                  </tr>
                ) : (
                  rows.map(({ lc, supplierName, poNo }) => {
                    const expiry = expiryBadge(lc.expiryDate);
                    const isUrgent = expiry && differenceInDays(new Date(lc.expiryDate!), new Date()) <= 7;
                    return (
                      <tr key={lc.id} className={`border-b hover:bg-slate-50 transition-colors ${isUrgent ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">{lc.lcNo}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{supplierName ?? '—'}</td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">{poNo ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 capitalize text-xs">{lc.lcType?.replace(/_/g, ' ') ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {lc.currency} {Number(lc.lcAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{lc.issuingBank}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">
                              {lc.expiryDate ? new Date(lc.expiryDate).toLocaleDateString('en-PK') : '—'}
                            </span>
                            {expiry && (
                              <span className={`text-xs ${expiry.cls}`}>
                                {differenceInDays(new Date(lc.expiryDate!), new Date()) <= 7 && <AlertTriangle className="h-3 w-3 inline" />}
                                {differenceInDays(new Date(lc.expiryDate!), new Date()) > 7 && differenceInDays(new Date(lc.expiryDate!), new Date()) <= 21 && <Clock className="h-3 w-3 inline" />}
                                {' '}{expiry.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lc.status ?? 'draft']}`}>
                            {(lc.status ?? 'draft').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/import/lc/${lc.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
