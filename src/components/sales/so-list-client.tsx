'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  pending_approval: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-teal-100 text-teal-700',
  partially_dispatched: 'bg-blue-100 text-blue-700',
  fully_dispatched: 'bg-indigo-100 text-indigo-700',
  invoiced: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_approval: 'Credit Hold', confirmed: 'Confirmed',
  partially_dispatched: 'Part. Dispatched', fully_dispatched: 'Dispatched',
  invoiced: 'Invoiced', closed: 'Closed', cancelled: 'Cancelled',
};

interface Row {
  id: string; soNo: string; soDate: string; status: string | null;
  creditCheck: string | null; grandTotalPkr: string | null;
  paymentTerms: string | null; requestedDeliveryDate: string | null;
  promisedDeliveryDate: string | null; quotationId: string | null;
  customerName: string | null; customerCode: string | null;
}

const STATUSES = ['all', 'draft', 'pending_approval', 'confirmed', 'partially_dispatched', 'fully_dispatched', 'closed', 'cancelled'];

export function SalesOrderListClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const today = new Date().toISOString().split('T')[0];

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || r.soNo.toLowerCase().includes(q) || (r.customerName ?? '').toLowerCase().includes(q);
    const matchS = status === 'all' || r.status === status;
    return matchQ && matchS;
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b flex gap-3 items-center flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SO no or customer…"
            className="border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs" />
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${status === s ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === 'pending_approval' ? 'Credit Hold' : s === 'all' ? 'All' : STATUS_LABEL[s] ?? s}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              {['SO No', 'Customer', 'Date', 'Delivery Req.', 'Grand Total', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const overdue = r.status === 'confirmed'
                && r.requestedDeliveryDate && r.requestedDeliveryDate < today;
              return (
                <tr key={r.id} className="border-b hover:bg-slate-50 group">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-teal-700">{r.soNo}</span>
                    {r.creditCheck === 'override' && (
                      <span className="ml-1.5 text-[10px] text-amber-500 font-medium">CREDIT OVERRIDE</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{r.customerName ?? '—'}</p>
                    {r.customerCode && <p className="text-xs text-slate-400">{r.customerCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.soDate}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.requestedDeliveryDate
                      ? <span className={overdue ? 'text-red-500 font-medium flex items-center gap-1' : 'text-slate-500'}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}{r.requestedDeliveryDate}
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800 text-xs">
                    {r.grandTotalPkr
                      ? `PKR ${parseFloat(r.grandTotalPkr).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_COLORS[r.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABEL[r.status ?? ''] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/orders/${r.id}`} className="text-teal-600 text-xs opacity-0 group-hover:opacity-100 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
