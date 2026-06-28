'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RETURN_REASONS = [
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'wrong_product', label: 'Wrong Product' },
  { value: 'excess_supply', label: 'Excess Supply' },
  { value: 'price_dispute', label: 'Price Dispute' },
  { value: 'other', label: 'Other' },
];

const RETURN_MODES = [
  { value: 'customer_delivers', label: 'Customer Delivers' },
  { value: 'company_collects', label: 'Company Collects' },
];

interface Customer { id: string; name: string }
interface Invoice { id: string; invoiceNo: string; invoiceDate: string; customerId: string; grandTotalPkr: string | null }
interface InvLine {
  id: string; productId?: string | null; hsCode?: string | null; description: string;
  qty: string | null; uom?: string | null; unitPricePkr?: string | null; productName?: string | null;
}

interface Props {
  customers: Customer[];
  invoices: Invoice[];
  preloadedInvoice?: Invoice | null;
  preloadedLines?: InvLine[];
}

interface ReturnLine {
  invoiceLineId?: string;
  productId?: string;
  hsCode?: string;
  description: string;
  returnQty: string;
  uom?: string;
  unitPricePkr?: string;
  lotNo?: string;
}

export function ReturnForm({ customers, invoices, preloadedInvoice, preloadedLines = [] }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [customerId, setCustomerId] = useState(preloadedInvoice?.customerId ?? '');
  const [invoiceId, setInvoiceId] = useState(preloadedInvoice?.id ?? '');
  const [raDate, setRaDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnReason, setReturnReason] = useState('quality_issue');
  const [description, setDescription] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [returnMode, setReturnMode] = useState('customer_delivers');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<ReturnLine[]>(() =>
    preloadedLines.map(l => ({
      invoiceLineId: l.id,
      productId: l.productId ?? undefined,
      hsCode: l.hsCode ?? undefined,
      description: l.productName ?? l.description,
      returnQty: '',
      uom: l.uom ?? undefined,
      unitPricePkr: l.unitPricePkr ?? undefined,
      lotNo: '',
    }))
  );

  // Filter invoices by selected customer
  const filteredInvoices = customerId
    ? invoices.filter(i => i.customerId === customerId)
    : invoices;

  function handleCustomerChange(cid: string) {
    setCustomerId(cid);
    setInvoiceId('');
    setLines([]);
  }

  function handleInvoiceChange(invId: string) {
    setInvoiceId(invId);
    setLines([]);
  }

  function addLine() {
    setLines(prev => [...prev, { description: '', returnQty: '', uom: '', unitPricePkr: '' }]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof ReturnLine, value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  const totalValue = lines.reduce((s, l) =>
    s + (parseFloat(l.returnQty || '0') * parseFloat(l.unitPricePkr || '0')), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId || !invoiceId || !returnReason) {
      setError('Customer, Invoice, and Return Reason are required');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one return item');
      return;
    }
    const emptyLine = lines.find(l => !l.description || !l.returnQty);
    if (emptyLine) {
      setError('All lines need description and return quantity');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/sales/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raDate, customerId, invoiceId, returnReason, description,
          expectedReturnDate: expectedReturnDate || null,
          returnMode, notes,
          lines: lines.map(l => ({
            invoiceLineId: l.invoiceLineId,
            productId: l.productId,
            hsCode: l.hsCode,
            description: l.description,
            returnQty: parseFloat(l.returnQty) || 0,
            uom: l.uom,
            unitPricePkr: l.unitPricePkr ? parseFloat(l.unitPricePkr) : null,
            lotNo: l.lotNo,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Save failed');
      }
      const ra = await res.json();
      router.push(`/sales/returns/${ra.id}`);
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

      {/* Header fields */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Return Authorization</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>RA Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={raDate} onChange={e => setRaDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Customer <span className="text-red-500">*</span></Label>
            <select
              value={customerId}
              onChange={e => handleCustomerChange(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Original Invoice <span className="text-red-500">*</span></Label>
            <select
              value={invoiceId}
              onChange={e => handleInvoiceChange(e.target.value)}
              required
              disabled={!customerId}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            >
              <option value="">Select invoice…</option>
              {filteredInvoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Return Reason <span className="text-red-500">*</span></Label>
            <select
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              required
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {RETURN_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Return Date</Label>
            <Input type="date" value={expectedReturnDate} onChange={e => setExpectedReturnDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Return Mode</Label>
            <select
              value={returnMode}
              onChange={e => setReturnMode(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {RETURN_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="col-span-3 space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Detailed reason for return..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Return Lines */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Return Items</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Add Item</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              {['Description', 'Lot No', 'Return Qty', 'UOM', 'Unit Price (PKR)', 'Total (PKR)', ''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {invoiceId ? 'Add return items above' : 'Select an invoice to pre-populate return items'}
                </td>
              </tr>
            )}
            {lines.map((l, i) => {
              const lineTotal = (parseFloat(l.returnQty || '0') * parseFloat(l.unitPricePkr || '0'));
              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Input
                      value={l.description}
                      onChange={e => updateLine(i, 'description', e.target.value)}
                      placeholder="Product / description"
                      required
                    />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <Input value={l.lotNo ?? ''} onChange={e => updateLine(i, 'lotNo', e.target.value)} placeholder="Lot #" />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <Input
                      type="number"
                      value={l.returnQty}
                      onChange={e => updateLine(i, 'returnQty', e.target.value)}
                      placeholder="Qty"
                      min="0"
                      step="0.001"
                      required
                    />
                  </td>
                  <td className="px-3 py-2 w-20">
                    <Input value={l.uom ?? ''} onChange={e => updateLine(i, 'uom', e.target.value)} placeholder="MT" />
                  </td>
                  <td className="px-3 py-2 w-36">
                    <Input
                      type="number"
                      value={l.unitPricePkr ?? ''}
                      onChange={e => updateLine(i, 'unitPricePkr', e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2 w-32 text-right tabular-nums font-medium text-slate-700">
                    {lineTotal > 0 ? lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
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
                <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Est. Return Value</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                  PKR {totalValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="font-semibold text-slate-800 text-sm">Notes</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Internal notes..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Return Authorization'}</Button>
      </div>
    </form>
  );
}
