'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, ChevronRight } from 'lucide-react';

interface Customer {
  id: string; code: string | null; name: string; customerType: string | null;
  ntn: string | null; strn: string | null; paymentTerms: string | null;
  creditLimitPkr: string | null; salesTaxCategory: string | null;
  fbrStatus: string | null; phone: string | null; email: string | null; isActive: boolean | null;
}

const TYPE_BADGE: Record<string, string> = {
  manufacturer: 'bg-blue-100 text-blue-700', trader: 'bg-purple-100 text-purple-700',
  distributor: 'bg-cyan-100 text-cyan-700', retailer: 'bg-amber-100 text-amber-700',
  government: 'bg-slate-100 text-slate-600',
};
const FBR_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700', non_filer: 'bg-red-100 text-red-600', exempt: 'bg-slate-100 text-slate-500',
};

const pkr = (v: string | null) => v && parseFloat(v) > 0
  ? `PKR ${parseFloat(v).toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : '—';

interface Props { rows: Customer[] }

export function CustomerListClient({ rows }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.customerType !== typeFilter) return false;
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'inactive' && r.isActive) return false;
      if (!q) return true;
      return [r.name, r.code, r.ntn, r.strn, r.phone, r.email].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, typeFilter, statusFilter]);

  const toggleActive = async (id: string) => {
    await fetch(`/api/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_active' }) });
    router.refresh();
    toast.success('Status updated');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, NTN…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          {['all', 'manufacturer', 'trader', 'distributor', 'retailer', 'government'].map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1 rounded text-xs font-medium ${statusFilter === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{filtered.length} customer{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Code', 'Name', 'Type', 'NTN / STRN', 'FBR', 'Credit Limit', 'Payment Terms', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-slate-400">No customers found</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className={`border-b hover:bg-slate-50 ${!r.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.code ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/customers/${r.id}`} className="font-medium text-slate-800 hover:text-teal-700">{r.name}</Link>
                    {r.phone && <p className="text-xs text-slate-400">{r.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${TYPE_BADGE[r.customerType ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                      {(r.customerType ?? '').charAt(0).toUpperCase() + (r.customerType ?? '').slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.ntn && <p className="font-mono">{r.ntn}</p>}
                    {r.strn && <p className="text-slate-400">{r.strn}</p>}
                    {!r.ntn && !r.strn && '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${FBR_BADGE[r.fbrStatus ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                      {(r.fbrStatus ?? 'active').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{pkr(r.creditLimitPkr)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{(r.paymentTerms ?? '').replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(r.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${r.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/customers/${r.id}`}>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
