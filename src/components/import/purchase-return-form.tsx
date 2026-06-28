'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RETURN_REASONS = [
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'wrong_product', label: 'Wrong Product' },
  { value: 'damaged', label: 'Damaged Goods' },
  { value: 'short_supply', label: 'Short Supply' },
  { value: 'price_dispute', label: 'Price Dispute' },
  { value: 'other', label: 'Other' },
];

const RETURN_MODES = [
  { value: 'company_ships', label: 'Company Ships Back' },
  { value: 'supplier_collects', label: 'Supplier Collects' },
];

interface Supplier { id: string; name: string }
interface PO { id: string; poNo: string; supplierId: string }
interface GRN { id: string; grnNo: string; poId: string | null }
interface GrnLine {
  id: string; productId?: string | null; hsCode?: string | null;
  receivedQty: string | null; rejectedQty: string | null;
  uom?: string | null; lotBatchNo?: string | null; productName?: string | null;
}

interface ReturnLine {
  grnLineId?: string;
  productId?: string;
  hsCode?: string;
  description: string;
  returnQty: string;
  uom?: string;
  unitPrice?: string;
  currency: string;
  lotNo?: string;
}

interface Props {
  suppliers: Supplier[];
  purchaseOrders: PO[];
  grns: GRN[];
  preloadedGrn?: GRN | null;
  preloadedLines?: GrnLine[];
}

export function PurchaseReturnForm({ suppliers, purchaseOrders, grns, preloadedGrn, preloadedLines = [] }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [supplierId, setSupplierId] = useState('');
  const [poId, setPoId] = useState(preloadedGrn?.poId ?? '');
  const [grnId, setGrnId] = useState(preloadedGrn?.id ?? '');
  const [praDate, setPraDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnReason, setReturnReason] = useState('quality_issue');
  const [description, setDescription] = useState('');
  const [expectedDispatchDate, setExpectedDispatchDate] = useState('');
  const [returnMode, setReturnMode] = useState('company_ships');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<ReturnLine[]>(() =>
    preloadedLines
      .filter(l => parseFloat(l.rejectedQty ?? '0') > 0) // only pre-fill rejected lines
      .map(l => ({
        grnLineId: l.id,
        productId: l.productId ?? undefined,
        hsCode: l.hsCode ?? undefined,
        description: l.productName ?? `Product (${l.id.slice(0, 8)})`,
        returnQty: l.rejectedQty ?? '',
        uom: l.uom ?? undefined,
        currency: 'USD',
        lotNo: l.lotBatchNo ?? '',
      }))
  );

  const filteredPos = supplierId ? purchaseOrders.filter(p => p.supplierId === supplierId) : purchaseOrders;
  const filteredGrns = poId ? grns.filter(g => g.poId === poId) : grns;

  function addLine() {
    setLines(prev => [...prev, { description: '', returnQty: '', currency: 'USD' }]);
  }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: keyof ReturnLine, value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  const totalValue = lines.reduce((s, l) =>
    s + parseFloat(l.returnQty || '0') * parseFloat(l.unitPrice || '0'), 0);
  const currency = lines[0]?.currency ?? 'USD';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !returnReason) { setError('Supplier and Return Reason are required'); return; }
    if (lines.length === 0) { setError('Add at least one return item'); return; }
    const bad = lines.find(l => !l.description || !l.returnQty);
    if (bad) { setError('All lines need description and return quantity'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/purchase/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          praDate, supplierId, poId: poId || null, grnId: grnId || null,
          returnReason, description, expectedDispatchDate: expectedDispatchDate || null,
          returnMode, notes,
          lines: lines.map(l => ({
            grnLineId: l.grnLineId,
            productId: l.productId,
            hsCode: l.hsCode,
            description: l.description,
            returnQty: parseFloat(l.returnQty) || 0,
            uom: l.uom,
            unitPrice: l.unitPrice ? parseFloat(l.unitPrice) : null,
            currency: l.currency,
            lotNo: l.lotNo,
          })),
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Save failed'); }
      const pra = await res.json();
      router.push(`/import/returns/${pra.id}`);
      router.refresh();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Purchase Return Authorization</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>PRA Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={praDate} onChange={e => setPraDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier <span className="text-red-500">*</span></Label>
            <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setPoId(''); setGrnId(''); }} required
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Return Reason <span className="text-red-500">*</span></Label>
            <select value={returnReason} onChange={e => setReturnReason(e.target.value)} required
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {RETURN_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked PO</Label>
            <select value={poId} onChange={e => { setPoId(e.target.value); setGrnId(''); }} disabled={!supplierId}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50">
              <option value="">None</option>
              {filteredPos.map(p => <option key={p.id} value={p.id}>{p.poNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked GRN</Label>
            <select value={grnId} onChange={e => setGrnId(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">None</option>
              {filteredGrns.map(g => <option key={g.id} value={g.id}>{g.grnNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Return Mode</Label>
            <select value={returnMode} onChange={e => setReturnMode(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {RETURN_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Dispatch Date</Label>
            <Input type="date" value={expectedDispatchDate} onChange={e => setExpectedDispatchDate(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Description</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Detailed reason for return..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
        </div>
      </div>

      {/* Return Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800 text-sm">Return Items</h2>
            {preloadedLines.length > 0 && <p className="text-xs text-slate-500 mt-0.5">Pre-filled from GRN rejected quantities</p>}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Add Item</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              {['Description', 'Lot No', 'Return Qty', 'UOM', 'Currency', 'Unit Price', 'Total', ''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Add return items</td></tr>
            )}
            {lines.map((l, i) => {
              const lineTotal = parseFloat(l.returnQty || '0') * parseFloat(l.unitPrice || '0');
              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 min-w-48">
                    <Input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Product / description" required />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <Input value={l.lotNo ?? ''} onChange={e => updateLine(i, 'lotNo', e.target.value)} placeholder="Lot #" />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <Input type="number" value={l.returnQty} onChange={e => updateLine(i, 'returnQty', e.target.value)} placeholder="Qty" min="0" step="0.001" required />
                  </td>
                  <td className="px-3 py-2 w-20">
                    <Input value={l.uom ?? ''} onChange={e => updateLine(i, 'uom', e.target.value)} placeholder="MT" />
                  </td>
                  <td className="px-3 py-2 w-20">
                    <select value={l.currency} onChange={e => updateLine(i, 'currency', e.target.value)}
                      className="w-full h-10 rounded-md border border-slate-300 px-2 text-sm focus:outline-none">
                      {['USD', 'EUR', 'CNY', 'PKR'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 w-32">
                    <Input type="number" value={l.unitPrice ?? ''} onChange={e => updateLine(i, 'unitPrice', e.target.value)} placeholder="0.0000" min="0" step="0.0001" />
                  </td>
                  <td className="px-3 py-2 w-32 text-right tabular-nums font-medium text-slate-700">
                    {lineTotal > 0 ? `${l.currency} ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-3 py-2 w-10">
                    <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totalValue > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Est. Return Value</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                  {currency} {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes..."
          className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Purchase Return Authorization'}</Button>
      </div>
    </form>
  );
}
