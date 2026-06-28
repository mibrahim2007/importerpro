'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

interface Rate { id: string; currency: string; rateDate: string; rate: string; source: string | null }
interface Props { rates: Rate[] }

const CURRENCIES = ['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY'];

export function ExchangeRatesPanel({ rates }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ currency: 'USD', rateDate: new Date().toISOString().split('T')[0], rate: '', source: 'sbp' });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.rate || parseFloat(form.rate) <= 0) return toast.error('Enter a valid rate');
    setLoading(true);
    try {
      const res = await fetch('/api/finance/exchange-rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      toast.success('Rate added');
      setForm((p) => ({ ...p, rate: '' }));
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* Add rate form */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add Rate</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <input type="date" value={form.rateDate} onChange={(e) => set('rateDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">PKR Rate (1 {form.currency} =)</label>
              <input type="number" step="0.0001" value={form.rate} onChange={(e) => set('rate', e.target.value)} placeholder="e.g. 278.50" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Source</label>
              <div className="flex gap-2">
                <select value={form.source} onChange={(e) => set('source', e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm">
                  <option value="sbp">SBP</option>
                  <option value="manual">Manual</option>
                </select>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleAdd} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Rate History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rates.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">No rates added yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Currency</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Date</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-500">PKR Rate</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Source</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{r.currency}</td>
                    <td className="px-4 py-2.5 text-slate-600">{new Date(r.rateDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800">{parseFloat(r.rate).toFixed(4)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.source === 'sbp' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.source ?? 'manual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
