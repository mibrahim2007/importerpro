'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Truck } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  approved: 'bg-amber-100 text-amber-700',
  gate_pass_issued: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-600',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', approved: 'Approved', gate_pass_issued: 'Gate Pass Issued',
  in_transit: 'In Transit', delivered: 'Delivered', returned: 'Returned',
};

interface Row {
  id: string; dcNo: string; dcDate: string; status: string | null;
  vehicleNo: string | null; gatePassNo: string | null;
  gateOutTime: unknown; estimatedArrivalDate: string | null;
  deliveryConfirmedDate: string | null; freightResponsibility: string | null;
  soNo: string | null; customerName: string | null; createdAt: unknown;
}
const STATUSES = ['all', 'draft', 'approved', 'gate_pass_issued', 'in_transit', 'delivered'];

export function DcListClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const today = new Date().toISOString().split('T')[0];

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || r.dcNo.toLowerCase().includes(q) || (r.customerName ?? '').toLowerCase().includes(q) || (r.soNo ?? '').toLowerCase().includes(q);
    const matchS = status === 'all' || r.status === status;
    return matchQ && matchS;
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b flex gap-3 items-center flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search DC no, SO no or customer…"
            className="border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs" />
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${status === s ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === 'all' ? 'All' : STATUS_LABEL[s] ?? s}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              {['DC No', 'Customer / SO', 'Date', 'Vehicle', 'Gate Pass', 'ETA', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const overdue = r.status === 'in_transit'
                && r.estimatedArrivalDate && r.estimatedArrivalDate < today;
              return (
                <tr key={r.id} className="border-b hover:bg-slate-50 group">
                  <td className="px-4 py-3 font-mono text-xs text-teal-700">{r.dcNo}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{r.customerName ?? '—'}</p>
                    {r.soNo && <p className="text-xs text-slate-400">SO: {r.soNo}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.dcDate}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.vehicleNo
                      ? <span className="flex items-center gap-1 text-slate-600"><Truck className="h-3.5 w-3.5" />{r.vehicleNo}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.gatePassNo ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.estimatedArrivalDate
                      ? <span className={overdue ? 'text-red-500 font-medium' : 'text-slate-500'}>{r.estimatedArrivalDate}</span>
                      : r.deliveryConfirmedDate
                        ? <span className="text-green-600">{r.deliveryConfirmedDate}</span>
                        : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_COLORS[r.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABEL[r.status ?? ''] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/dispatch/${r.id}`} className="text-teal-600 text-xs opacity-0 group-hover:opacity-100 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400 text-sm">No dispatch challans found.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
