'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Info, Download } from 'lucide-react';

function fmtPkr(v: number) {
  return v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  const color = pct >= 15 ? 'text-green-700 bg-green-50' : pct >= 5 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>{pct.toFixed(1)}%</span>;
}

export function MarginReportClient() {
  const now = new Date();
  const ytdStart = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().split('T')[0];

  const [from, setFrom] = useState(ytdStart);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/reports/margin?from=${from}&to=${to}`);
      if (res.ok) setResult(await res.json());
    } finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!result?.products.length) return;
    const header = ['Product', 'Code', 'HS Code', 'Total Qty Sold', 'UOM', 'Total Revenue (PKR)', 'Avg Selling Price', 'Avg Landed Cost', 'Total Cost', 'Gross Profit', 'Margin %', 'Invoices'];
    const rows = result.products.map((p: any) => [
      p.productName, p.productCode ?? '', p.hsCode ?? '',
      p.totalQtySold, p.uom ?? '', p.totalRevenue, p.avgSellingPrice,
      p.avgLandedCost ?? 'N/A', p.totalCost ?? 'N/A', p.grossProfit ?? 'N/A',
      p.marginPct !== null ? `${p.marginPct}%` : 'N/A', p.invoiceCount,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `gross-margin-${from}-to-${to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <strong>Gross Margin Report</strong> — Landed cost is pulled from the quotation's "Landed Cost Ref" field (set during quotation creation).
          Products without a quotation reference will show N/A for margin. For accurate margins, ensure landed cost refs are set on all quotation lines.
          <span className="ml-1 font-semibold">Green ≥15% · Amber ≥5% · Red &lt;5%</span>
        </p>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 ml-auto">
            {result && (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
              </Button>
            )}
            <Button className="bg-teal-600 hover:bg-teal-700" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Generate
            </Button>
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: `PKR ${fmtPkr(result.summary.totalRevenue)}`, color: 'text-teal-700' },
              { label: 'Total Cost (est.)', value: result.summary.productsWithCostData > 0 ? `PKR ${fmtPkr(result.summary.totalCost)}` : 'Partial data', color: 'text-slate-700' },
              { label: 'Gross Profit', value: result.summary.productsWithCostData > 0 ? `PKR ${fmtPkr(result.summary.totalProfit)}` : '—', color: result.summary.totalProfit > 0 ? 'text-green-700' : 'text-red-600' },
              { label: 'Overall Margin', value: result.summary.productsWithCostData > 0 ? `${result.summary.overallMargin.toFixed(1)}%` : '—',
                color: result.summary.overallMargin >= 15 ? 'text-green-700 font-black' : result.summary.overallMargin >= 5 ? 'text-amber-600' : 'text-red-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border rounded-xl p-4">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {result.summary.productsWithCostData < result.summary.productCount && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {result.summary.productCount - result.summary.productsWithCostData} of {result.summary.productCount} product{result.summary.productCount !== 1 ? 's' : ''} missing landed cost reference — margin N/A for those rows.
            </div>
          )}

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['Product', 'HS Code', 'Qty Sold', 'UOM', 'Revenue', 'Avg Sell Price', 'Avg Landed Cost', 'Gross Profit', 'Margin %', 'Inv.'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.products.map((p: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-700">{p.productName}</p>
                        {p.productCode && <p className="text-xs text-slate-400">{p.productCode}</p>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{p.hsCode ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{parseFloat(p.totalQtySold).toLocaleString('en-PK', { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">{p.uom ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">PKR {fmtPkr(p.totalRevenue)}</td>
                      <td className="px-3 py-2.5 text-right text-xs">PKR {fmtPkr(p.avgSellingPrice)}</td>
                      <td className="px-3 py-2.5 text-right text-xs">{p.avgLandedCost !== null ? `PKR ${fmtPkr(p.avgLandedCost)}` : <span className="text-slate-400">N/A</span>}</td>
                      <td className="px-3 py-2.5 text-right">{p.grossProfit !== null ? <span className={p.grossProfit >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>PKR {fmtPkr(p.grossProfit)}</span> : <span className="text-slate-400 text-xs">N/A</span>}</td>
                      <td className="px-3 py-2.5"><MarginBadge pct={p.marginPct} /></td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">{p.invoiceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
