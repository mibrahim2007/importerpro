'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface Row {
  lcId: string; lcNo: string; lcType: string | null; lcAmount: string;
  currency: string | null; issuingBank: string; openingDate: string | null;
  expiryDate: string; latestShipDate: string | null; status: string | null;
  supplierName: string | null; supplierCountry: string | null; totalCharges: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500', applied: 'bg-blue-100 text-blue-700',
  opened: 'bg-cyan-100 text-cyan-700', documents_presented: 'bg-purple-100 text-purple-600',
  under_scrutiny: 'bg-amber-100 text-amber-700', accepted: 'bg-green-100 text-green-700',
  retired: 'bg-slate-200 text-slate-500', expired: 'bg-red-100 text-red-600',
};

const MS_DAY = 86_400_000;
const daysToExpiry = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / MS_DAY);

interface Props { rows: Row[] }

export function LcRegisterClient({ rows }: Props) {
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);

  const totalOpen = filtered
    .filter((r) => !['retired', 'expired', 'cancelled'].includes(r.status ?? ''))
    .reduce((s, r) => s + parseFloat(r.lcAmount), 0);

  const handleExport = () => downloadCsv('lc-register.csv', filtered.map((r) => ({
    'LC No': r.lcNo, 'Type': r.lcType ?? '', 'Beneficiary': r.supplierName ?? '',
    'Country': r.supplierCountry ?? '', 'Amount': r.lcAmount, 'Currency': r.currency ?? '',
    'Issuing Bank': r.issuingBank, 'Opening Date': r.openingDate ?? '',
    'Expiry Date': r.expiryDate, 'Latest Ship Date': r.latestShipDate ?? '',
    'Status': r.status ?? '', 'Bank Charges (PKR)': r.totalCharges,
  })));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          {['all', 'draft', 'applied', 'opened', 'documents_presented', 'accepted', 'retired'].map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
        <div className="ml-auto text-sm">
          <span className="text-slate-400">Total Open: </span>
          <span className="font-bold text-slate-800">USD {totalOpen.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['LC No', 'Beneficiary', 'Amount', 'Bank', 'Opening', 'Expiry', 'Days Left', 'Bank Charges', 'Status'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-slate-400">No LCs found</td></tr>}
              {filtered.map((r) => {
                const days = daysToExpiry(r.expiryDate);
                return (
                  <tr key={r.lcId} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link href="/import/lc" className="font-mono text-teal-700 hover:underline text-xs">{r.lcNo}</Link>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="font-medium text-slate-700">{r.supplierName ?? '—'}</p>
                      <p className="text-slate-400">{r.supplierCountry ?? ''}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {r.currency} {parseFloat(r.lcAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{r.issuingBank}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{r.openingDate ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{r.expiryDate}</td>
                    <td className="px-3 py-3 text-xs">
                      {['retired', 'expired'].includes(r.status ?? '') ? '—' : (
                        <span className={days <= 7 ? 'text-red-600 font-bold' : days <= 15 ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                          {days}d
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-right">PKR {parseFloat(r.totalCharges).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_BADGE[r.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                        {(r.status ?? '').replace(/_/g, ' ')}
                      </span>
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
