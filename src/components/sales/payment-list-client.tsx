'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  cleared: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700',
  bounced: 'bg-red-100 text-red-600', cancelled: 'bg-slate-100 text-slate-400',
};
const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank TT',
  online: 'Online', pdc: 'PDC',
};

const TABS = ['All', 'Cleared', 'PDC Pending', 'Bounced', 'Aging Report'];

export function PaymentListClient({ initialReceipts, today }: { initialReceipts: any[]; today: string }) {
  const [tab, setTab] = useState('All');
  const [aging, setAging] = useState<any>(null);
  const [loadingAging, setLoadingAging] = useState(false);

  useEffect(() => {
    if (tab === 'Aging Report' && !aging) {
      setLoadingAging(true);
      fetch('/api/sales/aging').then((r) => r.json()).then((d) => { setAging(d); setLoadingAging(false); }).catch(() => setLoadingAging(false));
    }
  }, [tab]);

  const filtered = initialReceipts.filter((r) => {
    if (tab === 'Cleared') return r.status === 'cleared';
    if (tab === 'PDC Pending') return r.status === 'pending';
    if (tab === 'Bounced') return r.status === 'bounced';
    if (tab === 'Aging Report') return false;
    return r.status !== 'cancelled';
  });

  const fmt = (v: string | null) => v ? parseFloat(v).toLocaleString('en-PK', { maximumFractionDigits: 0 }) : '0';
  const fmtFull = (v: number) => v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-xl border">
      <div className="flex gap-1 p-2 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${tab === t ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Aging Report Tab */}
      {tab === 'Aging Report' && (
        <div className="p-4">
          {loadingAging && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>}
          {aging && (
            <div className="space-y-3">
              {/* Grand total row */}
              <div className="grid grid-cols-6 gap-3 mb-4">
                {[
                  { label: 'Total Receivable', value: aging.totals.total, color: 'text-slate-900' },
                  { label: 'Not Yet Due', value: aging.totals.current, color: 'text-slate-500' },
                  { label: '1–30 Days', value: aging.totals.bucket0_30, color: 'text-amber-600' },
                  { label: '31–60 Days', value: aging.totals.bucket31_60, color: 'text-orange-600' },
                  { label: '61–90 Days', value: aging.totals.bucket61_90, color: 'text-red-600' },
                  { label: '90+ Days', value: aging.totals.bucket90plus, color: 'text-red-800 font-bold' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="border rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                    <p className={`text-sm font-semibold ${color}`}>PKR {fmtFull(value)}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400">As of: {aging.asOf} · {aging.customers.length} customer{aging.customers.length !== 1 ? 's' : ''} with outstanding balance</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['Customer', 'Total Balance', 'Not Yet Due', '1–30 Days', '31–60 Days', '61–90 Days', '90+ Days', 'Credit Limit', 'Status'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aging.customers.map((c: any) => {
                    const overLimit = c.creditLimitPkr && parseFloat(c.creditLimitPkr) > 0 && c.total > parseFloat(c.creditLimitPkr);
                    return (
                      <tr key={c.customerId} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-700">
                          {c.customerName}
                          {c.customerCode && <span className="ml-1 text-xs text-slate-400">({c.customerCode})</span>}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">PKR {fmtFull(c.total)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{c.current > 0 ? `PKR ${fmtFull(c.current)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-xs">{c.bucket0_30 > 0 ? <span className="text-amber-700">PKR {fmtFull(c.bucket0_30)}</span> : '—'}</td>
                        <td className="px-3 py-2.5 text-xs">{c.bucket31_60 > 0 ? <span className="text-orange-700">PKR {fmtFull(c.bucket31_60)}</span> : '—'}</td>
                        <td className="px-3 py-2.5 text-xs">{c.bucket61_90 > 0 ? <span className="text-red-600">PKR {fmtFull(c.bucket61_90)}</span> : '—'}</td>
                        <td className="px-3 py-2.5 text-xs">{c.bucket90plus > 0 ? <span className="text-red-800 font-bold">PKR {fmtFull(c.bucket90plus)}</span> : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{c.creditLimitPkr && parseFloat(c.creditLimitPkr) > 0 ? `PKR ${fmtFull(parseFloat(c.creditLimitPkr))}` : 'Unlimited'}</td>
                        <td className="px-3 py-2.5">
                          {overLimit
                            ? <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertTriangle className="h-3 w-3" />OVER LIMIT</span>
                            : <span className="text-xs text-green-600">OK</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Receipt list */}
      {tab !== 'Aging Report' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Receipt No', 'Date', 'Customer', 'Method', 'Amount', 'Allocated', 'Unallocated', 'Cheque / Ref', 'Due Date', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-slate-400 text-sm">No records found</td></tr>
              )}
              {filtered.map((r) => {
                const pdcDueSoon = r.status === 'pending' && r.chequeDueDate && r.chequeDueDate <= new Date(today).toISOString().split('T')[0];
                return (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-teal-700">{r.receiptNo}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.receiptDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{r.customerName}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{METHOD_LABEL[r.paymentMethod ?? ''] ?? r.paymentMethod}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">PKR {fmt(r.totalAmountPkr)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{parseFloat(r.allocatedAmountPkr ?? '0') > 0 ? `PKR ${fmt(r.allocatedAmountPkr)}` : '—'}</td>
                    <td className="px-4 py-3 text-xs">{parseFloat(r.unallocatedAmountPkr ?? '0') > 0 ? <span className="text-amber-700">PKR {fmt(r.unallocatedAmountPkr)}</span> : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.chequeNo ?? r.referenceNo ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.chequeDueDate
                        ? <span className={pdcDueSoon ? 'text-red-600 font-semibold' : 'text-slate-500'}>{r.chequeDueDate}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLOR[r.status ?? ''] ?? ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/sales/payments/${r.id}`} className="text-xs text-teal-600 hover:underline font-medium">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
