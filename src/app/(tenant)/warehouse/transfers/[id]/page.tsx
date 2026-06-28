'use server';

import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { stockTransfers, stockTransferLines, products, warehouses, stockLocations } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TransferStatusActions } from '@/components/stock/transfer-status-actions';

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-500',
  validated: 'bg-blue-100 text-blue-700',
  done:      'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[transfer], lines] = await Promise.all([
    tdb.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1),
    tdb.select().from(stockTransferLines).where(eq(stockTransferLines.transferId, id)).orderBy(asc(stockTransferLines.sortOrder)),
  ]);

  if (!transfer) notFound();

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const [productRows, warehouseRows, locationRows] = await Promise.all([
    tdb.select({ id: products.id, name: products.name, code: products.code }).from(products),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
    tdb.select({ id: stockLocations.id, name: stockLocations.name }).from(stockLocations),
  ]);

  const prodMap = Object.fromEntries(productRows.map((p) => [p.id, p]));
  const whMap = Object.fromEntries(warehouseRows.map((w) => [w.id, w.name]));
  const locMap = Object.fromEntries(locationRows.map((l) => [l.id, l.name]));

  const role = session.user.role ?? '';
  const canManage = ['tenant_admin', 'store_manager', 'warehouse_manager'].includes(role);

  const totalQty = lines.reduce((s, l) => s + parseFloat(l.requestedQty), 0);

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/warehouse/transfers">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-mono font-bold text-slate-900">{transfer.transferNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[transfer.status ?? 'draft']}`}>
                {transfer.status === 'validated' ? 'In Transit' : transfer.status ?? 'draft'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
              <span className="font-medium text-slate-700">{whMap[transfer.fromWarehouseId]}</span>
              {transfer.fromLocationId && <span className="text-slate-400 text-xs">({locMap[transfer.fromLocationId]})</span>}
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{whMap[transfer.toWarehouseId]}</span>
              {transfer.toLocationId && <span className="text-slate-400 text-xs">({locMap[transfer.toLocationId]})</span>}
            </div>
          </div>
        </div>
      </div>

      <TransferStatusActions transferId={id} status={transfer.status ?? 'draft'} canManage={canManage} />

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Transfer Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Transfer Date', value: new Date(transfer.transferDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) },
                { label: 'Reason', value: transfer.reason ?? '—' },
                { label: 'Validated At', value: transfer.validatedAt ? new Date(transfer.validatedAt).toLocaleString('en-PK') : '—' },
                { label: 'Completed At', value: transfer.doneAt ? new Date(transfer.doneAt).toLocaleString('en-PK') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="font-medium text-slate-800">{value}</p>
                </div>
              ))}
              {transfer.notes && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Notes</p>
                  <p className="text-slate-600">{transfer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Items ({lines.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Product</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Lot / Batch</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-500">Qty</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-500">Done</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const prod = prodMap[l.productId];
                      return (
                        <tr key={l.id} className="border-b">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{prod?.name ?? l.productId}</p>
                            {prod?.code && <p className="text-xs text-slate-400 font-mono">{prod.code}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{l.lotBatchNo ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">{parseFloat(l.requestedQty).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-medium">{l.doneQty ? parseFloat(l.doneQty).toLocaleString() : '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{l.uom ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Lines</span>
                  <span className="text-white font-medium">{lines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Qty</span>
                  <span className="text-white font-medium">{totalQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Direction</span>
                  <span className="text-teal-300 font-medium text-xs">
                    {whMap[transfer.fromWarehouseId]} → {whMap[transfer.toWarehouseId]}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
