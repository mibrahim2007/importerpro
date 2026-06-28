'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface Row {
  productId: string; productName: string; productCode: string | null; productCategory: string | null;
  warehouseId: string; warehouseName: string;
  lotBatchNo: string | null; uom: string | null; totalQty: string; earliestReceipt: string | null;
}

const MS_DAY = 86_400_000;
const ageDays = (ts: string | null) => ts ? Math.floor((Date.now() - new Date(ts).getTime()) / MS_DAY) : null;

const AGE_CLASS = (d: number | null) =>
  d === null ? '' : d > 180 ? 'text-red-600 font-bold' : d > 90 ? 'text-orange-500 font-semibold' : d > 30 ? 'text-amber-600' : 'text-slate-600';

const AGE_LABEL = (d: number | null) =>
  d === null ? '—' : d > 180 ? `${d}d ⚠` : `${d}d`;

interface Props { rows: Row[] }

export function StockAgingClient({ rows }: Props) {
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [sort, setSort] = useState<'age' | 'qty'>('age');

  const warehouses = useMemo(() => Array.from(new Set(rows.map((r) => r.warehouseName))).sort(), [rows]);

  const filtered = useMemo(() => {
    let r = warehouseFilter === 'all' ? rows : rows.filter((x) => x.warehouseName === warehouseFilter);
    r = [...r].sort((a, b) => {
      if (sort === 'age') {
        const da = ageDays(a.earliestReceipt) ?? 0;
        const db = ageDays(b.earliestReceipt) ?? 0;
        return db - da;
      }
      return parseFloat(b.totalQty) - parseFloat(a.totalQty);
    });
    return r;
  }, [rows, warehouseFilter, sort]);

  const handleExport = () => downloadCsv('stock-aging.csv', filtered.map((r) => ({
    'Product Code': r.productCode ?? '', 'Product': r.productName, 'Category': r.productCategory ?? '',
    'Warehouse': r.warehouseName, 'Lot/Batch': r.lotBatchNo ?? '', 'Qty': r.totalQty, 'UOM': r.uom ?? '',
    'First Receipt': r.earliestReceipt ?? '', 'Age (days)': ageDays(r.earliestReceipt) ?? '',
  })));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Warehouses</option>
          {warehouses.map((w) => <option key={w}>{w}</option>)}
        </select>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['age', 'qty'] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)}
              className={`px-3 py-1 rounded text-xs font-medium ${sort === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
              Sort by {s === 'age' ? 'Age' : 'Qty'}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
        <span className="ml-auto text-xs text-slate-400">{filtered.length} lot{filtered.length !== 1 ? 's' : ''} in stock</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Product', 'Warehouse', 'Lot / Batch', 'Qty', 'First Receipt', 'Age', 'Aging Band'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-slate-400">No stock found</td></tr>}
              {filtered.map((r, i) => {
                const age = ageDays(r.earliestReceipt);
                return (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.productName}</p>
                      <p className="text-xs text-slate-400">{r.productCode ?? ''} {r.productCategory ? `· ${r.productCategory}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{r.warehouseName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.lotBatchNo ?? 'No lot'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{parseFloat(r.totalQty).toLocaleString()} {r.uom ?? ''}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.earliestReceipt ? new Date(r.earliestReceipt).toLocaleDateString('en-PK') : '—'}</td>
                    <td className={`px-4 py-3 font-mono ${AGE_CLASS(age)}`}>{AGE_LABEL(age)}</td>
                    <td className="px-4 py-3">
                      {age === null ? '' : (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          age > 180 ? 'bg-red-100 text-red-700' :
                          age > 90  ? 'bg-orange-100 text-orange-700' :
                          age > 30  ? 'bg-amber-100 text-amber-600' :
                                      'bg-green-100 text-green-700'
                        }`}>
                          {age > 180 ? '>6 months' : age > 90 ? '3–6 months' : age > 30 ? '1–3 months' : '<30 days'}
                        </span>
                      )}
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
