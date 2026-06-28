'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_ST_PCT = 17;

interface Customer { id: string; name: string }
interface Invoice { id: string; invoiceNo: string; invoiceDate: string; customerId: string; grandTotalPkr: string | null }
interface InvLine {
  id: string; productId?: string | null; hsCode?: string | null; description: string;
  qty: string | null; uom?: string | null; unitPricePkr?: string | null; salesTaxPct?: string | null; productName?: string | null;
}
interface PreloadedRa { id: string; raNo: string; customerId: string; invoiceId: string; returnReason: string }

interface Props {
  customers: Customer[];
  invoices: Invoice[];
  preloadedRa?: PreloadedRa | null;
  preloadedInvoiceId?: string | null;
  preloadedLines?: InvLine[];
}

interface CnLine {
  productId?: string;
  hsCode?: string;
  description: string;
  qty: string;
  uom?: string;
  unitPricePkr: string;
  salesTaxPct: string;
  salesTaxPkr?: string;
}

function computeST(qty: string, price: string, pct: string) {
  const taxable = parseFloat(qty || '0') * parseFloat(price || '0');
  return taxable * parseFloat(pct || '0') / 100;
}

export function CreditNoteForm({ customers, invoices, preloadedRa, preloadedInvoiceId, preloadedLines = [] }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const defaultCustomerId = preloadedRa?.customerId ?? '';
  const defaultLinkedInvoiceId = preloadedRa?.invoiceId ?? preloadedInvoiceId ?? '';

  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState(defaultLinkedInvoiceId);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [creditApplicationType, setCreditApplicationType] = useState('applied_to_invoice');
  const [internalNotes, setInternalNotes] = useState(
    preloadedRa ? `Ref: ${preloadedRa.raNo}` : ''
  );

  const [lines, setLines] = useState<CnLine[]>(() =>
    preloadedLines.map(l => ({
      productId: l.productId ?? undefined,
      hsCode: l.hsCode ?? undefined,
      description: l.productName ?? l.description,
      qty: '',
      uom: l.uom ?? undefined,
      unitPricePkr: l.unitPricePkr ?? '',
      salesTaxPct: l.salesTaxPct ?? String(DEFAULT_ST_PCT),
    }))
  );

  const filteredInvoices = customerId ? invoices.filter(i => i.customerId === customerId) : invoices;

  function addLine() {
    setLines(prev => [...prev, { description: '', qty: '', unitPricePkr: '', salesTaxPct: String(DEFAULT_ST_PCT) }]);
  }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: keyof CnLine, value: string) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      // Auto-compute ST when qty/price/pct change
      if (['qty', 'unitPricePkr', 'salesTaxPct'].includes(field)) {
        updated.salesTaxPkr = String(computeST(updated.qty, updated.unitPricePkr, updated.salesTaxPct).toFixed(2));
      }
      return updated;
    }));
  }

  const subtotal = lines.reduce((s, l) => s + parseFloat(l.qty || '0') * parseFloat(l.unitPricePkr || '0'), 0);
  const salesTax = lines.reduce((s, l) => s + parseFloat(l.salesTaxPkr || String(computeST(l.qty, l.unitPricePkr, l.salesTaxPct))), 0);
  const grandTotal = subtotal + salesTax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId || !invoiceDate) { setError('Customer and date are required'); return; }
    if (lines.length === 0) { setError('Add at least one line'); return; }
    const emptyLine = lines.find(l => !l.description || !l.qty || !l.unitPricePkr);
    if (emptyLine) { setError('All lines need description, quantity, and unit price'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/sales/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceDate,
          customerId,
          raId: preloadedRa?.id ?? null,
          linkedInvoiceId: linkedInvoiceId || null,
          creditApplicationType,
          internalNotes: internalNotes || null,
          lines: lines.map(l => ({
            productId: l.productId,
            hsCode: l.hsCode,
            description: l.description,
            qty: parseFloat(l.qty) || 0,
            uom: l.uom,
            unitPricePkr: parseFloat(l.unitPricePkr) || 0,
            salesTaxPct: parseFloat(l.salesTaxPct) || 0,
            salesTaxPkr: parseFloat(l.salesTaxPkr ?? String(computeST(l.qty, l.unitPricePkr, l.salesTaxPct))) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Save failed');
      }
      const cn = await res.json();
      router.push(`/sales/credit-notes/${cn.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {preloadedRa && (
        <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-700">
          Linked to Return Authorization <strong>{preloadedRa.raNo}</strong>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Credit Note Details</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>CN Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Customer <span className="text-red-500">*</span></Label>
            <select
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setLinkedInvoiceId(''); }}
              required
              disabled={!!preloadedRa}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            >
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked Invoice (Original)</Label>
            <select
              value={linkedInvoiceId}
              onChange={e => setLinkedInvoiceId(e.target.value)}
              disabled={!!preloadedRa || !customerId}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            >
              <option value="">None</option>
              {filteredInvoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Application Type</Label>
            <select
              value={creditApplicationType}
              onChange={e => setCreditApplicationType(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="applied_to_invoice">Applied to Invoice</option>
              <option value="refund">Refund to Customer</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Internal Notes</Label>
            <Input value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="e.g. Ref RA-2026-0001, Quality issue return…" />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Credit Note Lines (Sales Tax Reversal @ 17%)</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                {['Product / Description', 'Qty', 'UOM', 'Unit Price (PKR)', 'Taxable Value', 'ST%', 'Sales Tax (PKR)', 'Line Total', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No lines added yet</td></tr>
              )}
              {lines.map((l, i) => {
                const taxable = parseFloat(l.qty || '0') * parseFloat(l.unitPricePkr || '0');
                const st = parseFloat(l.salesTaxPkr ?? String(computeST(l.qty, l.unitPricePkr, l.salesTaxPct)));
                const lineTotal = taxable + st;
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 min-w-48">
                      <Input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description" required />
                    </td>
                    <td className="px-3 py-2 w-24">
                      <Input type="number" value={l.qty} onChange={e => updateLine(i, 'qty', e.target.value)} placeholder="Qty" min="0" step="0.001" required />
                    </td>
                    <td className="px-3 py-2 w-20">
                      <Input value={l.uom ?? ''} onChange={e => updateLine(i, 'uom', e.target.value)} placeholder="MT" />
                    </td>
                    <td className="px-3 py-2 w-32">
                      <Input type="number" value={l.unitPricePkr} onChange={e => updateLine(i, 'unitPricePkr', e.target.value)} placeholder="0.00" min="0" step="0.01" required />
                    </td>
                    <td className="px-3 py-2 w-32 text-right tabular-nums text-slate-700">
                      {taxable > 0 ? taxable.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-3 py-2 w-16">
                      <Input type="number" value={l.salesTaxPct} onChange={e => updateLine(i, 'salesTaxPct', e.target.value)} placeholder="17" min="0" max="100" />
                    </td>
                    <td className="px-3 py-2 w-32 text-right tabular-nums text-blue-700">
                      {st > 0 ? st.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '0.00'}
                    </td>
                    <td className="px-3 py-2 w-32 text-right tabular-nums font-semibold">
                      {lineTotal > 0 ? lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
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
      </div>

      {/* Totals card */}
      {lines.length > 0 && (
        <div className="rounded-xl bg-slate-900 text-white p-5 max-w-sm ml-auto">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Credit Note Total</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Subtotal</dt>
              <dd className="font-mono">PKR {subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Sales Tax (Reversal)</dt>
              <dd className="font-mono text-blue-300">PKR {salesTax.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <dt className="font-semibold text-slate-100">Total Credit</dt>
              <dd className="font-mono font-bold text-teal-400 text-lg">PKR {grandTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Credit Note'}</Button>
      </div>
    </form>
  );
}
