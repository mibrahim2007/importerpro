'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Supplier { id: string; name: string; country?: string | null }
interface Bill { id: string; billNo: string; supplierId: string | null; totalAmountPkr: string | null; balanceDue: string | null }
interface PreloadedPra { id: string; praNo: string; supplierId: string; poId: string | null }
interface PreloadedLine {
  id: string; productId?: string | null; description: string;
  returnQty: string | null; uom?: string | null; unitPrice?: string | null; currency?: string | null; productName?: string | null;
}

interface DnLine {
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  taxPct: string;
  taxAmount: string;
}

interface Props {
  suppliers: Supplier[];
  bills: Bill[];
  preloadedPra?: PreloadedPra | null;
  preloadedLines?: PreloadedLine[];
  preloadedSupplierId?: string | null;
  preloadedBillId?: string | null;
}

export function PurchaseDebitNoteForm({ suppliers, bills, preloadedPra, preloadedLines = [], preloadedSupplierId, preloadedBillId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [supplierId, setSupplierId] = useState(preloadedSupplierId ?? '');
  const [linkedBillId, setLinkedBillId] = useState(preloadedBillId ?? '');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('280');
  const [debitApplicationType, setDebitApplicationType] = useState('applied_to_bill');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [notes, setNotes] = useState(preloadedPra ? `Ref: ${preloadedPra.praNo}` : '');

  const [lines, setLines] = useState<DnLine[]>(() =>
    preloadedLines.length > 0
      ? preloadedLines.map(l => {
          const qty = parseFloat(l.returnQty ?? '1');
          const price = parseFloat(l.unitPrice ?? '0');
          const amount = qty * price;
          return {
            description: l.productName ?? l.description,
            quantity: String(qty),
            unitPrice: String(price),
            amount: String(amount),
            taxPct: '0',
            taxAmount: '0',
          };
        })
      : [{ description: '', quantity: '1', unitPrice: '', amount: '', taxPct: '0', taxAmount: '0' }]
  );

  const filteredBills = supplierId ? bills.filter(b => b.supplierId === supplierId) : bills;

  function addLine() { setLines(prev => [...prev, { description: '', quantity: '1', unitPrice: '', amount: '', taxPct: '0', taxAmount: '0' }]); }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: keyof DnLine, value: string) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const u = { ...l, [field]: value };
      if (['quantity', 'unitPrice', 'taxPct'].includes(field)) {
        const qty = parseFloat(u.quantity || '1');
        const price = parseFloat(u.unitPrice || '0');
        const amt = qty * price;
        const tax = amt * parseFloat(u.taxPct || '0') / 100;
        u.amount = String(amt.toFixed(2));
        u.taxAmount = String(tax.toFixed(2));
      }
      return u;
    }));
  }

  const subtotal = lines.reduce((s, l) => s + parseFloat(l.amount || '0'), 0);
  const totalTax = lines.reduce((s, l) => s + parseFloat(l.taxAmount || '0'), 0);
  const totalFx = subtotal + totalTax;
  const totalPkr = currency === 'PKR' ? totalFx : totalFx * parseFloat(exchangeRate || '1');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !billDate) { setError('Supplier and date are required'); return; }
    if (lines.length === 0) { setError('Add at least one line'); return; }
    const bad = lines.find(l => !l.description || !l.amount);
    if (bad) { setError('All lines need description and amount'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/purchase/debit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billDate,
          supplierId,
          praId: preloadedPra?.id ?? null,
          linkedBillId: linkedBillId || null,
          debitApplicationType,
          currency,
          exchangeRate: parseFloat(exchangeRate) || 1,
          supplierInvoiceNo: supplierInvoiceNo || null,
          notes: notes || null,
          lines: lines.map(l => ({
            description: l.description,
            quantity: parseFloat(l.quantity) || 1,
            unitPrice: l.unitPrice ? parseFloat(l.unitPrice) : null,
            amount: parseFloat(l.amount) || 0,
            taxPct: parseFloat(l.taxPct) || 0,
            taxAmount: parseFloat(l.taxAmount) || 0,
          })),
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Save failed'); }
      const dn = await res.json();
      router.push(`/import/debit-notes/${dn.id}`);
      router.refresh();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {preloadedPra && (
        <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-700">
          Linked to Purchase Return Authorization <strong>{preloadedPra.praNo}</strong>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Debit Note Details</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>DN Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier <span className="text-red-500">*</span></Label>
            <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setLinkedBillId(''); }} required
              disabled={!!preloadedPra}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked Vendor Bill</Label>
            <select value={linkedBillId} onChange={e => setLinkedBillId(e.target.value)} disabled={!supplierId}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50">
              <option value="">None</option>
              {filteredBills.map(b => <option key={b.id} value={b.id}>{b.billNo} (PKR {parseFloat(b.balanceDue ?? '0').toLocaleString('en-PK', { maximumFractionDigits: 0 })} due)</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              {['USD', 'EUR', 'CNY', 'PKR'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {currency !== 'PKR' && (
            <div className="space-y-1.5">
              <Label>Exchange Rate (PKR per {currency})</Label>
              <Input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} step="0.01" min="0" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Application Type</Label>
            <select value={debitApplicationType} onChange={e => setDebitApplicationType(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="applied_to_bill">Applied to Vendor Bill</option>
              <option value="supplier_credit">Supplier Credit (not applied)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Supplier Ref. No</Label>
            <Input value={supplierInvoiceNo} onChange={e => setSupplierInvoiceNo(e.target.value)} placeholder="Supplier's CN/credit reference" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Ref PRA-2026-0001, quality rejection..." />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Debit Note Lines ({currency})</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              {['Description', 'Qty', 'Unit Price', 'Amount', 'Tax%', 'Tax Amount', 'Total', ''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => {
              const lineTotal = parseFloat(l.amount || '0') + parseFloat(l.taxAmount || '0');
              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 min-w-48">
                    <Input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description" required />
                  </td>
                  <td className="px-3 py-2 w-20">
                    <Input type="number" value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} min="0" step="0.001" />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <Input type="number" value={l.unitPrice} onChange={e => updateLine(i, 'unitPrice', e.target.value)} placeholder="0.0000" min="0" step="0.0001" />
                  </td>
                  <td className="px-3 py-2 w-28 text-right tabular-nums">
                    {parseFloat(l.amount || '0') > 0 ? parseFloat(l.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="px-3 py-2 w-16">
                    <Input type="number" value={l.taxPct} onChange={e => updateLine(i, 'taxPct', e.target.value)} placeholder="0" min="0" max="100" />
                  </td>
                  <td className="px-3 py-2 w-28 text-right tabular-nums text-blue-700">
                    {parseFloat(l.taxAmount || '0') > 0 ? parseFloat(l.taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                  <td className="px-3 py-2 w-28 text-right tabular-nums font-semibold">
                    {lineTotal > 0 ? lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="px-3 py-2 w-8">
                    <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      {lines.length > 0 && (
        <div className="rounded-xl bg-slate-900 text-white p-5 max-w-sm ml-auto">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Debit Note Total</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Subtotal ({currency})</dt>
              <dd className="font-mono">{currency} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
            </div>
            {totalTax > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Tax</dt>
                <dd className="font-mono text-blue-300">{currency} {totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="text-slate-200">Total ({currency})</dt>
              <dd className="font-mono">{currency} {totalFx.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="font-semibold text-slate-100">Total (PKR)</dt>
              <dd className="font-mono font-bold text-amber-400 text-lg">PKR {totalPkr.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Debit Note'}</Button>
      </div>
    </form>
  );
}
