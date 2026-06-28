'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Loader2, Banknote } from 'lucide-react';

interface Charge {
  id: string;
  chargeType: string;
  description: string | null;
  amount: string;
  currency: string | null;
  chargedDate: string | null;
  notes: string | null;
}

const CHARGE_LABELS: Record<string, string> = {
  opening_commission: 'Opening Commission',
  swift: 'SWIFT Charges',
  handling: 'Handling Charges',
  amendment: 'Amendment Fee',
  acceptance: 'Acceptance Commission',
  retirement: 'Retirement Charges',
  discrepancy_fee: 'Discrepancy Fee',
  other: 'Other',
};

const CHARGE_TYPES = Object.entries(CHARGE_LABELS).map(([value, label]) => ({ value, label }));

export function LcChargesPanel({ lcId, charges: initial }: { lcId: string; charges: Charge[] }) {
  const router = useRouter();
  const [charges, setCharges] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    chargeType: 'opening_commission',
    description: '',
    amount: '',
    currency: 'PKR',
    chargedDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const totalByPkr = charges
    .filter((c) => (c.currency ?? 'PKR') === 'PKR')
    .reduce((s, c) => s + Number(c.amount), 0);
  const totalByUsd = charges
    .filter((c) => c.currency === 'USD')
    .reduce((s, c) => s + Number(c.amount), 0);

  const add = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter amount'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/lc/${lcId}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), notes: form.notes || undefined }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setCharges((prev) => [created, ...prev]);
      setAdding(false);
      setForm({ chargeType: 'opening_commission', description: '', amount: '', currency: 'PKR', chargedDate: new Date().toISOString().split('T')[0], notes: '' });
      router.refresh();
    } catch {
      toast.error('Failed to add charge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Banknote className="h-4 w-4" /> Bank Charges</CardTitle>
          {!adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Charge
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Totals */}
        <div className="flex gap-4 text-sm">
          {totalByPkr > 0 && (
            <div className="bg-slate-50 rounded px-3 py-2">
              <p className="text-xs text-slate-400">Total (PKR)</p>
              <p className="font-bold text-slate-800">₨ {totalByPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
            </div>
          )}
          {totalByUsd > 0 && (
            <div className="bg-slate-50 rounded px-3 py-2">
              <p className="text-xs text-slate-400">Total (USD)</p>
              <p className="font-bold text-slate-800">${totalByUsd.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Add form */}
        {adding && (
          <div className="p-3 border rounded-lg space-y-3 bg-slate-50">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Charge Type</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white"
                  value={form.chargeType}
                  onChange={(e) => setForm((f) => ({ ...f, chargeType: e.target.value }))}>
                  {CHARGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.chargedDate}
                  onChange={(e) => setForm((f) => ({ ...f, chargedDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount <span className="text-red-500">*</span></Label>
                <div className="flex gap-2">
                  <select className="w-20 border rounded-md px-2 py-1.5 text-sm bg-white"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                    <option>PKR</option><option>USD</option><option>EUR</option>
                  </select>
                  <Input type="number" step="0.01" className="flex-1" placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description / Notes</Label>
                <Input placeholder="Opening @ 0.20% per qtr"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={add} disabled={loading}>
                {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
              </Button>
            </div>
          </div>
        )}

        {/* Charges list */}
        {charges.length === 0 && !adding ? (
          <p className="text-sm text-slate-400 text-center py-4">No charges recorded yet</p>
        ) : (
          <div className="space-y-0">
            {charges.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 border-b last:border-0 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{CHARGE_LABELS[c.chargeType] ?? c.chargeType}</p>
                  {c.description && <p className="text-xs text-slate-400">{c.description}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">
                    {c.currency ?? 'PKR'} {Number(c.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {c.chargedDate && <p className="text-xs text-slate-400">{new Date(c.chargedDate).toLocaleDateString('en-PK')}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
