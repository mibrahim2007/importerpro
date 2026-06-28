'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Tag } from 'lucide-react';

interface PriceRow {
  id: string; productId: string | null; productName: string | null; productCode: string | null;
  priceTier: string | null; pricingBasis: string | null;
  unitPricePkr: string | null; markupPct: string | null;
  effectiveFrom: string | null; effectiveTo: string | null; isActive: boolean | null;
}
interface Product { id: string; name: string; code: string | null }
interface Props { customerId: string; pricelists: PriceRow[]; products: Product[] }

const TIERS = ['standard', 'distributor', 'oem', 'government'];
const BASES = [
  { value: 'fixed', label: 'Fixed PKR/unit' },
  { value: 'markup_pct', label: 'Markup % over landed cost' },
];
const BLANK = { productId: '', priceTier: 'standard', pricingBasis: 'fixed', unitPricePkr: '', markupPct: '', effectiveFrom: '', effectiveTo: '' };

const pkr = (v: string | null) => v ? `PKR ${parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '—';

export function PricelistPanel({ customerId, pricelists: initial, products }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.productId) return toast.error('Select a product');
    if (form.pricingBasis === 'fixed' && !form.unitPricePkr) return toast.error('Enter a unit price');
    if (form.pricingBasis === 'markup_pct' && !form.markupPct) return toast.error('Enter a markup %');
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_price', ...form }),
      });
      if (!res.ok) throw new Error('Failed');
      router.refresh(); setAdding(false); setForm(BLANK);
      toast.success('Price added');
    } catch { toast.error('Failed to save price'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (priceId: string) => {
    await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_price', priceId }),
    });
    setRows((prev) => prev.filter((r) => r.id !== priceId));
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">{rows.length} Price{rows.length !== 1 ? 's' : ''} Set</h2>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setAdding(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Add Price
        </Button>
      </div>

      {adding && (
        <Card className="border-teal-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Price Entry</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Product *</label>
              <select value={form.productId} onChange={(e) => set('productId', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Price Tier</label>
              <select value={form.priceTier} onChange={(e) => set('priceTier', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {TIERS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Pricing Basis</label>
              <select value={form.pricingBasis} onChange={(e) => set('pricingBasis', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            {form.pricingBasis === 'fixed' ? (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Unit Price (PKR)</label>
                <input type="number" value={form.unitPricePkr} onChange={(e) => set('unitPricePkr', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Markup %</label>
                <input type="number" value={form.markupPct} onChange={(e) => set('markupPct', e.target.value)} placeholder="e.g. 15" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Effective From</label>
              <input type="date" value={form.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Effective To</label>
              <input type="date" value={form.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Save Price
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 && !adding ? (
            <p className="text-center py-10 text-slate-400 text-sm">No special pricing set. Default market rates apply.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  {['Product', 'Tier', 'Basis', 'Price / Markup', 'Valid From', 'Valid To', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{r.productName ?? '—'}</p>
                      {r.productCode && <p className="text-xs text-slate-400">{r.productCode}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-teal-100 text-teal-700">
                        {(r.priceTier ?? '').charAt(0).toUpperCase() + (r.priceTier ?? '').slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{(r.pricingBasis ?? '').replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                      {r.pricingBasis === 'markup_pct' ? `${r.markupPct}% markup` : pkr(r.unitPricePkr)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.effectiveFrom ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.effectiveTo ?? 'Open'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(r.id)} className="text-slate-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
