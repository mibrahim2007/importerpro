'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense', 'cogs'] as const;
const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expense: 'Expenses', cogs: 'Cost of Goods Sold',
};
const TYPE_COLORS: Record<string, string> = {
  asset: 'text-blue-600 bg-blue-50', liability: 'text-red-600 bg-red-50',
  equity: 'text-purple-600 bg-purple-50', revenue: 'text-green-600 bg-green-50',
  expense: 'text-orange-600 bg-orange-50', cogs: 'text-amber-600 bg-amber-50',
};

interface Account {
  id: string; code: string; name: string; accountType: string;
  parentCode: string | null; isGroup: boolean | null;
  isActive: boolean | null; isSystem: boolean | null;
  openingBalance: string | null; currency: string | null; notes: string | null;
}

const EMPTY_FORM = { code: '', name: '', accountType: 'asset', parentCode: '', isGroup: false, currency: 'PKR', openingBalance: '', notes: '' };

export function AccountsPanel({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = accounts.filter((a) => a.accountType === t).sort((a, b) => a.code.localeCompare(b.code));
    return acc;
  }, {} as Record<string, Account[]>);

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) return toast.error('Code and name are required');
    setLoading(true);
    try {
      const res = await fetch('/api/finance/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, openingBalance: form.openingBalance || '0' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { account } = await res.json();
      setAccounts((prev) => [...prev, account]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success(`Account ${account.code} created`);
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const toggleActive = async (acc: Account) => {
    try {
      const res = await fetch(`/api/finance/accounts/${acc.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !acc.isActive }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, isActive: !a.isActive } : a));
      toast.success(acc.isActive ? 'Account deactivated' : 'Account activated');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Add Account Form */}
      {showForm ? (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">New Account</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Account Code *</label>
                <input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. 1105"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Account Name *</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Cash in Safe"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type *</label>
                <select value={form.accountType} onChange={(e) => set('accountType', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Parent Code</label>
                <input value={form.parentCode} onChange={(e) => set('parentCode', e.target.value)} placeholder="e.g. 1100"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Currency</label>
                <select value={form.currency} onChange={(e) => set('currency', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {['PKR', 'USD', 'EUR', 'CNY', 'GBP', 'AED'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Opening Balance</label>
                <input type="number" step="0.01" value={form.openingBalance} onChange={(e) => set('openingBalance', e.target.value)}
                  placeholder="0.00" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional description"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="isGroup" checked={!!form.isGroup} onChange={(e) => set('isGroup', e.target.checked)}
                  className="h-4 w-4 text-teal-600" />
                <label htmlFor="isGroup" className="text-sm text-slate-600">Group / header account (no direct postings)</label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={loading}
                className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Account
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> New Account
        </button>
      )}

      {/* Accounts grouped by type */}
      {TYPES.map((type) => {
        const list = grouped[type];
        if (!list?.length) return null;
        const isCollapsed = collapsed[type];
        return (
          <Card key={type}>
            <button
              onClick={() => setCollapsed((p) => ({ ...p, [type]: !p[type] }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[type]}`}>{TYPE_LABELS[type]}</span>
                <span className="text-xs text-slate-400">{list.length} accounts</span>
              </div>
            </button>
            {!isCollapsed && (
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-t border-b">
                      <th className="text-left px-4 py-2 font-medium text-slate-500 w-28">Code</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Name</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Parent</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Currency</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-500">Opening Bal</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((acc) => (
                      <tr key={acc.id} className={`border-b hover:bg-slate-50 ${!acc.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2.5 font-mono text-slate-700 text-xs">{acc.code}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {acc.isGroup && <Building2 className="h-3.5 w-3.5 text-slate-400" />}
                            <span className={acc.isGroup ? 'font-semibold text-slate-700' : 'text-slate-600'}>{acc.name}</span>
                            {acc.isSystem && <span className="text-xs text-slate-400">(system)</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{acc.parentCode ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{acc.currency ?? 'PKR'}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-600">
                          {parseFloat(acc.openingBalance ?? '0') !== 0
                            ? parseFloat(acc.openingBalance ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => toggleActive(acc)}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                            {acc.isActive ? 'active' : 'inactive'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
