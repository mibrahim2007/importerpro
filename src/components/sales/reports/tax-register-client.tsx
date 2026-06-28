'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Info } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtPkr(v: number) {
  return v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TaxRegisterClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/reports/tax-register?year=${year}&month=${month}`);
      if (res.ok) setResult(await res.json());
    } finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!result?.lines.length) return;
    const header = ['HS Code', 'Description', 'Total Qty', 'UOM', 'Taxable Value (PKR)', 'Tax Rate %', 'Sales Tax (PKR)', 'Invoice Count'];
    const rows = result.lines.map((r: any) => [
      r.hsCode, r.description, r.totalQty, r.uom ?? '', r.taxableValue, r.taxRate, r.salesTax, r.invoiceCount,
    ]);
    const footer = ['', 'GRAND TOTAL', '', '', result.grandTaxable, '', result.grandTax, ''];
    const csv = [header, ...rows, footer].map((r) => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `fbr-tax-register-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      {/* Header + info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>FBR Output Tax Register (ST-3)</strong> — Shows all taxable supplies by HS code for the selected month.
          Use this to prepare your monthly Sales Tax Return on the FBR IRIS portal.
          Standard rate: 17% | Zero-rated: 0% | Exempt: not shown (no ST).
        </p>
      </div>

      {/* Period picker */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm w-40">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm w-28">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
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
          {/* Summary by rate — ST-3 format */}
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(result.byRate).map(([rate, vals]: [string, any]) => (
              <div key={rate} className="bg-white border rounded-xl p-4">
                <p className="text-xs text-slate-400">ST Rate: <strong>{rate}%</strong></p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable Value</span>
                    <span className="font-semibold">PKR {fmtPkr(vals.taxableValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sales Tax</span>
                    <span className="font-semibold text-blue-700">PKR {fmtPkr(vals.salesTax)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Grand total banner */}
          <div className="bg-teal-600 text-white rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-teal-200">Period: {MONTHS[month - 1]} {year}</p>
              <p className="font-semibold">Total Output Tax (ST-3 Line 1)</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-teal-200">Taxable Value: PKR {fmtPkr(result.grandTaxable)}</p>
              <p className="text-2xl font-black">PKR {fmtPkr(result.grandTax)}</p>
            </div>
          </div>

          {/* Detail table by HS code */}
          {result.lines.length === 0 ? (
            <div className="bg-white border rounded-xl text-center py-10 text-slate-400 text-sm">
              No posted invoices found for {MONTHS[month - 1]} {year}
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Detail by HS Code</p>
                <p className="text-xs text-slate-400">{result.lines.length} line{result.lines.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {['HS Code', 'Description', 'Total Qty', 'UOM', 'Taxable Value (PKR)', 'ST Rate', 'Sales Tax (PKR)', 'Invoices'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((r: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-teal-700 font-semibold">{r.hsCode}</td>
                        <td className="px-4 py-2.5 text-slate-700">{r.description}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{parseFloat(r.totalQty).toLocaleString('en-PK', { maximumFractionDigits: 3 })}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{r.uom ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">PKR {fmtPkr(r.taxableValue)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.taxRate === 17 ? 'bg-blue-100 text-blue-700' : r.taxRate === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.taxRate}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-blue-700">PKR {fmtPkr(r.salesTax)}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{r.invoiceCount} inv.</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-teal-50 border-t-2 border-teal-200 font-bold">
                      <td colSpan={4} className="px-4 py-3 text-sm text-teal-700">GRAND TOTAL</td>
                      <td className="px-4 py-3 text-right text-sm">PKR {fmtPkr(result.grandTaxable)}</td>
                      <td />
                      <td className="px-4 py-3 text-right text-sm text-blue-700">PKR {fmtPkr(result.grandTax)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
