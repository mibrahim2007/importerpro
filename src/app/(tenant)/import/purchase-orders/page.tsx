import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { purchaseOrders, poLines, suppliers } from '@/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, ChevronRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-blue-100 text-blue-700',
  lc_requested: 'bg-indigo-100 text-indigo-700',
  lc_opened: 'bg-violet-100 text-violet-700',
  goods_dispatched: 'bg-amber-100 text-amber-700',
  partially_received: 'bg-orange-100 text-orange-700',
  fully_received: 'bg-green-100 text-green-700',
  invoiced: 'bg-teal-100 text-teal-700',
  closed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  lc_requested: 'LC Requested',
  lc_opened: 'LC Opened',
  goods_dispatched: 'Dispatched',
  partially_received: 'Part. Received',
  fully_received: 'Received',
  invoiced: 'Invoiced',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export default async function PurchaseOrdersPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const statusCounts = await tdb
    .select({ status: purchaseOrders.status, n: count() })
    .from(purchaseOrders).groupBy(purchaseOrders.status);
  const countMap = Object.fromEntries(statusCounts.map((r) => [r.status, r.n]));

  const rows = await tdb
    .select({
      po: purchaseOrders,
      supplierName: suppliers.name,
      lineCount: sql<number>`count(distinct ${poLines.id})`,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(poLines, eq(poLines.poId, purchaseOrders.id))
    .groupBy(purchaseOrders.id, suppliers.name)
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(100);

  const summaryCards = [
    { label: 'Draft', count: countMap['draft'] ?? 0, color: 'text-slate-600' },
    { label: 'Confirmed', count: countMap['confirmed'] ?? 0, color: 'text-blue-600' },
    { label: 'In Transit', count: (countMap['lc_opened'] ?? 0) + (countMap['goods_dispatched'] ?? 0), color: 'text-amber-600' },
    { label: 'Received', count: (countMap['fully_received'] ?? 0) + (countMap['partially_received'] ?? 0), color: 'text-green-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Import POs with full LC tracking</p>
        </div>
        <Link href="/import/purchase-orders/new">
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-1.5" /> New PO
          </Button>
        </Link>
      </div>

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
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">PO No</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Supplier</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Incoterms</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Lines</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600">CIF Value (USD)</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Ship By</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No purchase orders yet.{' '}
                      <Link href="/import/purchase-orders/new" className="text-teal-600 hover:underline">
                        Create your first PO →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  rows.map(({ po, supplierName, lineCount }) => (
                    <tr key={po.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">{po.poNo}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {po.poDate ? new Date(po.poDate).toLocaleDateString('en-PK') : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{supplierName ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{po.incoterms ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{Number(lineCount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {po.cifValueUsd
                          ? `$${Number(po.cifValueUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {po.latestShipDate ? new Date(po.latestShipDate).toLocaleDateString('en-PK') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status ?? 'draft']}`}>
                          {STATUS_LABEL[po.status ?? 'draft'] ?? po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/import/purchase-orders/${po.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
