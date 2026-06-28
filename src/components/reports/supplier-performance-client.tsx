'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface Row {
  supplierId: string; supplierName: string; supplierCountry: string | null; leadTimeDays: number | null;
  poCount: number; completedPoCount: number; totalCifUsd: string;
  onTimeCount: number; arrivedCount: number; avgGrnDays: string | null;
}

interface Props { rows: Row[] }

const stars = (pct: number) => {
  if (pct >= 90) return '★★★★★';
  if (pct >= 75) return '★★★★☆';
  if (pct >= 60) return '★★★☆☆';
  if (pct >= 40) return '★★☆☆☆';
  return '★☆☆☆☆';
};

export function SupplierPerformanceClient({ rows }: Props) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => parseFloat(b.totalCifUsd) - parseFloat(a.totalCifUsd)),
    [rows]
  );

  const handleExport = () => downloadCsv('supplier-performance.csv', sorted.map((r) => {
    const onTimePct = r.arrivedCount > 0 ? Math.round((r.onTimeCount / r.arrivedCount) * 100) : null;
    return {
      'Supplier': r.supplierName, 'Country': r.supplierCountry ?? '',
      'Total POs': r.poCount, 'Completed POs': r.completedPoCount,
      'Total CIF USD': r.totalCifUsd, 'Avg Lead Time (days)': r.avgGrnDays ? Math.round(parseFloat(r.avgGrnDays)) : '',
      'On-Time Delivery %': onTimePct ?? '', 'Shipments Arrived': r.arrivedCount,
    };
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
        <span className="text-xs text-slate-400">{sorted.length} supplier{sorted.length !== 1 ? 's' : ''}</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Supplier', 'Country', 'POs', 'Completed', 'Total CIF', 'Avg Lead Time', 'On-Time %', 'Rating'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-400">No suppliers found</td></tr>}
              {sorted.map((r) => {
                const onTimePct = r.arrivedCount > 0 ? Math.round((r.onTimeCount / r.arrivedCount) * 100) : null;
                const avgDays = r.avgGrnDays ? Math.round(parseFloat(r.avgGrnDays)) : null;
                return (
                  <tr key={r.supplierId} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.supplierName}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.supplierCountry ?? '—'}</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700">{r.poCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={r.completedPoCount > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}>{r.completedPoCount}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">${parseFloat(r.totalCifUsd).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {avgDays !== null ? (
                        <span className={avgDays > 120 ? 'text-red-600' : avgDays > 60 ? 'text-amber-600' : 'text-green-600'}>
                          {avgDays}d
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {onTimePct !== null ? (
                        <span className={onTimePct >= 80 ? 'text-green-600 font-semibold' : onTimePct >= 60 ? 'text-amber-600' : 'text-red-600'}>
                          {onTimePct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-amber-400">
                      {onTimePct !== null ? stars(onTimePct) : '—'}
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
