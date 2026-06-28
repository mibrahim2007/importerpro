'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', posted: 'Posted', sent: 'Sent',
  partially_paid: 'Part. Paid', fully_paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500', posted: 'bg-blue-100 text-blue-700',
  sent: 'bg-indigo-100 text-indigo-700', partially_paid: 'bg-amber-100 text-amber-700',
  fully_paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
};
const FBR_COLOR: Record<string, string> = {
  pending: 'text-slate-400', submitted: 'text-blue-500', accepted: 'text-green-600',
  rejected: 'text-red-500', cancelled: 'text-slate-400',
};
const TYPE_LABEL: Record<string, string> = {
  tax_invoice: 'Tax Invoice', simplified_invoice: 'Simplified',
  credit_note: 'Credit Note', debit_note: 'Debit Note',
};

const TABS = ['All', 'Draft', 'Unpaid', 'Overdue', 'Paid', 'Cancelled'];
const today = new Date().toISOString().split('T')[0];

export function InvoiceListClient({ initialRows }: { initialRows: any[] }) {
  const [tab, setTab] = useState('All');

  const filtered = initialRows.filter((r) => {
    if (tab === 'Draft') return r.status === 'draft';
    if (tab === 'Unpaid') return ['posted', 'sent', 'partially_paid'].includes(r.status);
    if (tab === 'Overdue') return r.status === 'overdue' || (
      ['posted', 'sent', 'partially_paid'].includes(r.status) && r.dueDate && r.dueDate < today
    );
    if (tab === 'Paid') return r.status === 'fully_paid';
    if (tab === 'Cancelled') return r.status === 'cancelled';
    return true;
  });

  const fmt = (v: string | null) => v
    ? parseFloat(v).toLocaleString('en-PK', { maximumFractionDigits: 0 })
    : '0';

  return (
    <div className="bg-white rounded-xl border">
      {/* Tab bar */}
      <div className="flex gap-1 p-2 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${tab === t ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              {['Invoice No', 'Type', 'Date', 'Customer', 'Grand Total', 'Balance Due', 'Due Date', 'Status', 'FBR', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">No invoices found</td></tr>
            )}
            {filtered.map((r) => {
              const isOverdue = ['posted', 'sent', 'partially_paid'].includes(r.status) && r.dueDate && r.dueDate < today;
              return (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-teal-700">{r.invoiceNo}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{TYPE_LABEL[r.invoiceType] ?? r.invoiceType}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{r.invoiceDate}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{r.customerName}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 text-right">PKR {fmt(r.grandTotalPkr)}</td>
                  <td className={`px-4 py-3 font-semibold text-right ${parseFloat(r.balancePkr ?? '0') > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    PKR {fmt(r.balancePkr)}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className={isOverdue ? 'text-red-600 font-semibold flex items-center gap-1' : 'text-slate-500'}>
                      {isOverdue && <AlertTriangle className="h-3 w-3" />}{r.dueDate ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[r.status ?? ''] ?? ''}`}>
                      {isOverdue && r.status !== 'overdue' ? 'Overdue' : STATUS_LABEL[r.status ?? ''] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${FBR_COLOR[r.fbrStatus ?? 'pending']}`}>
                      {r.fbrInvoiceNo ? r.fbrInvoiceNo : (r.fbrStatus ?? 'pending')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/invoices/${r.id}`} className="text-xs text-teal-600 hover:underline font-medium">View</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
