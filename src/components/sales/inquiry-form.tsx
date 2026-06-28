'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Customer { id: string; name: string; code: string | null }
interface Product { id: string; name: string; code: string | null; uom: string | null }
interface Props { customers: Customer[]; products: Product[] }

const BLANK_LINE = { productId: '', tentativeQty: '', uom: '', targetPricePkr: '', notes: '' };
const TODAY = new Date().toISOString().split('T')[0];

export function InquiryForm({ customers, products }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: '', date: TODAY, receivedVia: 'phone', requiredByDate: '', notes: '',
  });
  const [lines, setLines] = useState([{ ...BLANK_LINE }]);
  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setLine = (i: number, k: string, v: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const onProductChange = (i: number, productId: string) => {
    const p = products.find((p) => p.id === productId);
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, productId, uom: p?.uom ?? '' } : l));
  };

  const handleSave = async () => {
    if (!form.customerId) return toast.error('Select a customer');
    if (!lines[0].productId) return toast.error('Add at least one product');
    setSaving(true);
    try {
      const res = await fetch('/api/sales/inquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lines: lines.filter((l) => l.productId) }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(`Inquiry ${data.inquiryNo} created`);
      router.push(`/sales/inquiries/${data.id}`);
    } catch { toast.error('Failed to create inquiry'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Inquiry Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Customer *</label>
            <select value={form.customerId} onChange={(e) => setF('customerId', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={(e) => setF('date', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Received Via</label>
            <select value={form.receivedVia} onChange={(e) => setF('receivedVia', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {['phone', 'whatsapp', 'email', 'visit'].map((v) => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Required By</label>
            <input type="date" value={form.requiredByDate} onChange={(e) => setF('requiredByDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setF('notes', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Products Inquired</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, { ...BLANK_LINE }])}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                {i === 0 && <label className="block text-xs text-slate-500 mb-1">Product *</label>}
                <select value={line.productId} onChange={(e) => onProductChange(i, e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs text-slate-500 mb-1">Qty</label>}
                <input type="number" value={line.tentativeQty} onChange={(e) => setLine(i, 'tentativeQty', e.target.value)} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                {i === 0 && <label className="block text-xs text-slate-500 mb-1">UOM</label>}
                <input value={line.uom} onChange={(e) => setLine(i, 'uom', e.target.value)} placeholder="KG" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs text-slate-500 mb-1">Target PKR/unit</label>}
                <input type="number" value={line.targetPricePkr} onChange={(e) => setLine(i, 'targetPricePkr', e.target.value)} placeholder="Customer's price" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs text-slate-500 mb-1">Notes</label>}
                <input value={line.notes} onChange={(e) => setLine(i, 'notes', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1 flex justify-end pb-0.5">
                {lines.length > 1 && (
                  <button onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Save Inquiry
        </Button>
      </div>
    </div>
  );
}
