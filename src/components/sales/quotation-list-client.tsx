'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  revised: 'bg-amber-100 text-amber-700',
  expired: 'bg-orange-100 text-orange-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

interface Row {
  id: string; quotationNo: string; revisionNo: number | null; date: string;
  validUntil: string; status: string | null; grandTotalPkr: string | null;
  paymentTerms: string | null; customerName: string | null; customerCode: string | null;
}
const STATUSES = ['all', 'draft', 'sent', 'accepted', 'rejected', 'revised', 'expired'];

export function QuotationListClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const today = new Date().toISOString().split('T')[0];

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || r.quotationNo.toLowerCase().includes(q) || (r.customerName ?? '').toLowerCase().includes(q);
    const matchS = status === 'all' || r.status === status;
    return matchQ && matchS;
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b flex gap-3 items-center flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotation no or customer…"
            className="border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs" />
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${status === s ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              {['Quotation No', 'Customer', 'Date', 'Valid Until', 'Grand Total', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const expired = r.status === 'sent' && r.validUntil < today;
              return (
                <tr key={r.id} className="border-b hover:bg-slate-50 group">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-teal-700">{r.quotationNo}</span>
                    {(r.revisionNo ?? 0) > 0 && <span className="ml-1.5 text-[10px] text-slate-400">Rev {r.revisionNo}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{r.customerName ?? '—'}</p>
                    {r.customerCode && <p className="text-xs text-slate-400">{r.customerCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={expired ? 'text-red-500 font-medium' : 'text-slate-500'}>{r.validUntil}</span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                    {r.grandTotalPkr
                      ? `PKR ${parseFloat(r.grandTotalPkr).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${expired ? 'bg-orange-100 text-orange-600' : (STATUS_COLORS[r.status ?? ''] ?? 'bg-slate-100 text-slate-500')}`}>
                      {expired ? 'Expired' : r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/quotations/${r.id}`} className="text-teal-600 text-xs opacity-0 group-hover:opacity-100 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No quotations found.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
