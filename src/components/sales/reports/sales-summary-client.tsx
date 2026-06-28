'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All (excl. draft)' },
  { value: 'posted', label: 'Posted' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'fully_paid', label: 'Fully Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

function fmtPkr(v: number) {
  return v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SalesSummaryClient({ customers }: { customers: { id: string; name: string }[] }) {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ lines: any[]; summary: any } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, status });
      if (customerId) params.set('customerId', customerId);
      const res = await fetch(`/api/sales/reports/summary?${params}`);
      if (res.ok) setResult(await res.json());
    } finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!result?.lines.length) return;
    const header = ['Invoice No', 'Date', 'Customer', 'Product', 'HS Code', 'Qty', 'UOM', 'Unit Price', 'Discount', 'Taxable Value', 'ST%', 'Sales Tax', 'FBR Invoice No', 'Status'];
    const rows = result.lines.map((r) => [
      r.invoice_no, r.invoice_date, r.customer_name, r.product_name ?? r.description ?? '', r.hs_code ?? '',
      r.qty, r.uom ?? '', r.unit_price_pkr, r.discount_pkr ?? 0,
      r.taxable_value_pkr, r.sales_tax_pct, r.sales_tax_pkr,
      r.fbr_invoice_no ?? '', r.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `sales-summary-${from}-to-${to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border rounded-xl p-4">
        <div className="grid grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">All Customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          {result && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
            </Button>
          )}
          <Button className="bg-teal-600 hover:bg-teal-700" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Generate Report
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {result && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Invoices', value: result.summary.invoiceCount, color: 'text-slate-700' },
            { label: 'Taxable Value', value: `PKR ${fmtPkr(result.summary.totalTaxableValue)}`, color: 'text-slate-700' },
            { label: 'Sales Tax', value: `PKR ${fmtPkr(result.summary.totalSalesTax)}`, color: 'text-blue-700' },
            { label: 'Grand Total', value: `PKR ${fmtPkr(result.summary.totalRevenue)}`, color: 'text-teal-700 font-bold' },
            { label: 'Balance Due', value: `PKR ${fmtPkr(result.summary.totalBalance)}`, color: result.summary.totalBalance > 0 ? 'text-red-600' : 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase">{label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Line items table */}
      {result && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {result.lines.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">No invoices found for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['Invoice No', 'Date', 'Customer', 'Product', 'HS Code', 'Qty', 'UOM', 'Unit Price', 'Discount', 'Taxable Value', 'ST%', 'Sales Tax', 'Status', 'FBR No'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-teal-700 font-semibold">{r.invoice_no}</td>
                      <td className="px-3 py-2 text-slate-500">{r.invoice_date}</td>
                      <td className="px-3 py-2 font-medium text-slate-700 max-w-[140px] truncate">{r.customer_name}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate">{r.product_name ?? r.description ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">{r.hs_code ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{r.qty}</td>
                      <td className="px-3 py-2 text-slate-400">{r.uom ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{fmtPkr(parseFloat(r.unit_price_pkr ?? '0'))}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{parseFloat(r.discount_pkr ?? '0') > 0 ? fmtPkr(parseFloat(r.discount_pkr)) : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtPkr(parseFloat(r.taxable_value_pkr ?? '0'))}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{r.sales_tax_pct}%</td>
                      <td className="px-3 py-2 text-right text-blue-700 font-semibold">{fmtPkr(parseFloat(r.sales_tax_pkr ?? '0'))}</td>
                      <td className="px-3 py-2 capitalize">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-green-700">{r.fbr_invoice_no ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
