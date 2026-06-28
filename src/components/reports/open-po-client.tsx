'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface Row {
  poId: string; poNo: string; poDate: string; status: string | null;
  supplierName: string | null; supplierCountry: string | null;
  cifValueUsd: string | null; currency: string | null; latestShipDate: string | null;
  orderedQty: string; eta: string | null; shipmentStatus: string | null; receivedQty: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500', confirmed: 'bg-blue-100 text-blue-700',
  lc_requested: 'bg-cyan-100 text-cyan-700', lc_opened: 'bg-teal-100 text-teal-700',
  goods_dispatched: 'bg-amber-100 text-amber-700',
};

const MS_DAY = 86_400_000;

interface Props { rows: Row[] }

export function OpenPoClient({ rows }: Props) {
  const totalValue = useMemo(() =>
    rows.reduce((s, r) => s + parseFloat(r.cifValueUsd ?? '0'), 0), [rows]
  );

  const handleExport = () => downloadCsv('open-po-status.csv', rows.map((r) => {
    const ordered = parseFloat(r.orderedQty);
    const received = parseFloat(r.receivedQty);
    const pending = Math.max(0, ordered - received);
    return {
      'PO No': r.poNo, 'PO Date': r.poDate, 'Supplier': r.supplierName ?? '',
      'CIF USD': r.cifValueUsd ?? '', 'Status': r.status ?? '',
      'Ordered Qty': ordered, 'Received Qty': received, 'Pending Qty': pending,
      'ETA': r.eta ?? '', 'Latest Ship Date': r.latestShipDate ?? '',
    };
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
        <span className="text-xs text-slate-400">{rows.length} open PO{rows.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto text-sm">
          <span className="text-slate-400">Total Open Value: </span>
          <span className="font-bold text-slate-800">USD {totalValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['PO No', 'Supplier', 'CIF USD', 'Status', 'Ordered', 'Received', 'Pending', 'Progress', 'ETA'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-slate-400">No open POs</td></tr>}
              {rows.map((r) => {
                const ordered = parseFloat(r.orderedQty);
                const received = parseFloat(r.receivedQty);
                const pending = Math.max(0, ordered - received);
                const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
                const daysToEta = r.eta ? Math.ceil((new Date(r.eta).getTime() - Date.now()) / MS_DAY) : null;
                return (
                  <tr key={r.poId} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link href={`/import/purchase-orders/${r.poId}`} className="font-mono text-teal-700 hover:underline text-xs">{r.poNo}</Link>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="font-medium text-slate-700">{r.supplierName ?? '—'}</p>
                      <p className="text-slate-400">{r.supplierCountry ?? ''}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">${parseFloat(r.cifValueUsd ?? '0').toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[r.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                        {(r.status ?? '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{ordered.toLocaleString()}</td>
                    <td className="px-3 py-3 font-mono text-xs text-green-600">{received.toLocaleString()}</td>
                    <td className="px-3 py-3 font-mono text-xs text-amber-600">{pending.toLocaleString()}</td>
                    <td className="px-3 py-3 w-24">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{pct}%</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {daysToEta !== null ? (
                        <span className={daysToEta < 0 ? 'text-red-600 font-semibold' : daysToEta <= 7 ? 'text-amber-600' : 'text-slate-600'}>
                          {r.eta}
                          {daysToEta < 0 ? ` (${Math.abs(daysToEta)}d late)` : daysToEta === 0 ? ' (today)' : ` (${daysToEta}d)`}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
