'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Phone, Mail, Globe, Users } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  quoted: 'bg-teal-100 text-teal-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

const VIA_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-3.5 w-3.5 text-green-500" />,
  email: <Mail className="h-3.5 w-3.5 text-blue-400" />,
  phone: <Phone className="h-3.5 w-3.5 text-slate-400" />,
  visit: <Users className="h-3.5 w-3.5 text-amber-500" />,
};

interface Row {
  id: string; inquiryNo: string; date: string; status: string | null;
  receivedVia: string | null; requiredByDate: string | null;
  linkedQuotationId: string | null; notes: string | null; createdAt: unknown;
  customerName: string | null; customerCode: string | null;
}

const STATUSES = ['all', 'new', 'quoted', 'won', 'lost', 'cancelled'];

export function InquiryListClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || r.inquiryNo.toLowerCase().includes(q) || (r.customerName ?? '').toLowerCase().includes(q);
    const matchS = status === 'all' || r.status === status;
    return matchQ && matchS;
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b flex gap-3 items-center">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inquiry no or customer…"
            className="border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
          />
          <div className="flex gap-1">
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
              {['Inquiry No', 'Customer', 'Date', 'Required By', 'Channel', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono text-xs text-teal-700">{r.inquiryNo}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700">{r.customerName ?? '—'}</p>
                  {r.customerCode && <p className="text-xs text-slate-400">{r.customerCode}</p>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{r.date}</td>
                <td className="px-4 py-3 text-xs">
                  {r.requiredByDate
                    ? <span className={new Date(r.requiredByDate) < new Date() && r.status !== 'won' && r.status !== 'cancelled' ? 'text-red-500 font-medium' : 'text-slate-500'}>
                        {r.requiredByDate}
                      </span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {VIA_ICON[r.receivedVia ?? ''] ?? <Globe className="h-3.5 w-3.5 text-slate-300" />}
                    <span className="text-xs text-slate-500 capitalize">{r.receivedVia ?? '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${STATUS_COLORS[r.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/sales/inquiries/${r.id}`} className="text-teal-600 text-xs opacity-0 group-hover:opacity-100 hover:underline">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No inquiries found.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
