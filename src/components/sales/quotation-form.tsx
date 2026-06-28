'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface Customer {
  id: string; name: string; code: string | null;
  salesTaxCategory: string | null; whtRatePct: string | null; paymentTerms: string | null;
}
interface Product { id: string; name: string; code: string | null; uom: string | null }
interface PrefillLine { productId: string; productName: string | null; tentativeQty: string | null; uom: string | null }

interface Props {
  customers: Customer[]; products: Product[];
  prefillCustomerId?: string; prefillInquiryId?: string;
  prefillLines?: PrefillLine[];
}

interface Line {
  productId: string; qty: string; uom: string;
  unitPricePkr: string; discountPct: string; salesTaxPct: string; landedCostRefPkr: string;
  netUnitPricePkr: number; totalPkr: number; salesTaxPkr: number; marginPct: number | null;
}

const TODAY = new Date().toISOString().split('T')[0];
const IN30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

const BLANK_LINE = (): Line => ({
  productId: '', qty: '', uom: '', unitPricePkr: '', discountPct: '0',
  salesTaxPct: '17', landedCostRefPkr: '',
  netUnitPricePkr: 0, totalPkr: 0, salesTaxPkr: 0, marginPct: null,
});

const calcLine = (l: Line): Line => {
  const unit = parseFloat(l.unitPricePkr || '0');
  const disc = parseFloat(l.discountPct || '0');
  const qty = parseFloat(l.qty || '0');
  const tax = parseFloat(l.salesTaxPct || '0');
  const lc = parseFloat(l.landedCostRefPkr || '0');
  const netUnit = unit * (1 - disc / 100);
  const total = netUnit * qty;
  const taxAmt = total * (tax / 100);
  const margin = netUnit > 0 && lc > 0 ? ((netUnit - lc) / netUnit) * 100 : null;
  return { ...l, netUnitPricePkr: netUnit, totalPkr: total, salesTaxPkr: taxAmt, marginPct: margin };
};

const pkr = (n: number) => `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function QuotationForm({ customers, products, prefillCustomerId, prefillInquiryId, prefillLines }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState(prefillCustomerId ?? '');
  const [form, setForm] = useState({
    date: TODAY, validUntil: IN30, paymentTerms: 'net_30',
    termsConditions: '', internalNotes: '',
  });
  const [lines, setLines] = useState<Line[]>(
    prefillLines?.length
      ? prefillLines.map((pl) => ({ ...BLANK_LINE(), productId: pl.productId, qty: pl.tentativeQty ?? '', uom: pl.uom ?? '' }))
      : [BLANK_LINE()]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const onCustomerChange = (id: string) => {
    setCustomerId(id);
    const c = customers.find((c) => c.id === id);
    if (c?.paymentTerms) setForm((p) => ({ ...p, paymentTerms: c.paymentTerms! }));
    const isTaxRegistered = c?.salesTaxCategory && c.salesTaxCategory !== 'non_filer';
    setLines((prev) => prev.map((l) => calcLine({ ...l, salesTaxPct: isTaxRegistered ? '17' : '0' })));
  };

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? calcLine({ ...l, ...patch }) : l));
  };

  const onProductChange = (i: number, productId: string) => {
    const p = products.find((p) => p.id === productId);
    updateLine(i, { productId, uom: p?.uom ?? '' });
  };

  const subtotal = lines.reduce((s, l) => s + l.totalPkr, 0);
  const totalTax = lines.reduce((s, l) => s + l.salesTaxPkr, 0);
  const grandTotal = subtotal + totalTax;
  const whtRate = parseFloat(selectedCustomer?.whtRatePct ?? '4.5') / 100;
  const whtPkr = grandTotal * whtRate;
  const netPayable = grandTotal - whtPkr;

  const handleSave = async () => {
    if (!customerId) return toast.error('Select a customer');
    if (!lines.some((l) => l.productId && parseFloat(l.qty || '0') > 0))
      return toast.error('Add at least one product line with quantity');
    setSaving(true);
    try {
      const res = await fetch('/api/sales/quotations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, customerId,
          inquiryId: prefillInquiryId || null,
          lines: lines.filter((l) => l.productId && parseFloat(l.qty || '0') > 0).map((l) => ({
            productId: l.productId, qty: l.qty, uom: l.uom,
            unitPricePkr: l.unitPricePkr, discountPct: l.discountPct,
            salesTaxPct: l.salesTaxPct, landedCostRefPkr: l.landedCostRefPkr || null,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(`Quotation ${data.quotationNo} created`);
      router.push(`/sales/quotations/${data.id}`);
    } catch { toast.error('Failed to create quotation'); }
    finally { setSaving(false); }
  };

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Quotation Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Customer *</label>
            <select value={customerId} onChange={(e) => onCustomerChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>)}
            </select>
            {selectedCustomer && (
              <p className="mt-1 text-xs text-slate-400">
                FBR: {selectedCustomer.salesTaxCategory ?? '—'} · WHT: {selectedCustomer.whtRatePct ?? '4.5'}%
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={(e) => setF('date', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Valid Until *</label>
            <input type="date" value={form.validUntil} onChange={(e) => setF('validUntil', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Terms</label>
            <select value={form.paymentTerms} onChange={(e) => setF('paymentTerms', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {['advance', 'cod', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'].map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ').replace('net', 'Net')}</option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Terms & Conditions (printed on quotation)</label>
            <textarea rows={2} value={form.termsConditions} onChange={(e) => setF('termsConditions', e.target.value)}
              placeholder="e.g. Prices valid for 30 days. Delivery within 7 working days of order confirmation."
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Internal Notes</label>
            <textarea rows={2} value={form.internalNotes} onChange={(e) => setF('internalNotes', e.target.value)}
              placeholder="Not shown on PDF"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Line Items</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, BLANK_LINE()])}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Line
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  {['Product', 'Qty', 'UOM', 'Unit Price (PKR)', 'Disc %', 'Net Unit', 'Total', 'Tax %', 'Tax Amt', 'LC Ref', 'Margin', ''].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2">
                      <select value={l.productId} onChange={(e) => onProductChange(i, e.target.value)} className="border rounded px-2 py-1.5 text-xs w-40">
                        <option value="">Select…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })}
                        className="border rounded px-2 py-1.5 text-xs w-20 text-right" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={l.uom} onChange={(e) => updateLine(i, { uom: e.target.value })}
                        className="border rounded px-2 py-1.5 text-xs w-14" placeholder="KG" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={l.unitPricePkr} onChange={(e) => updateLine(i, { unitPricePkr: e.target.value })}
                        className="border rounded px-2 py-1.5 text-xs w-28 text-right font-mono" placeholder="0.00" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={l.discountPct} onChange={(e) => updateLine(i, { discountPct: e.target.value })}
                        className={`border rounded px-2 py-1.5 text-xs w-16 text-right ${parseFloat(l.discountPct || '0') > 5 ? 'bg-amber-50 border-amber-300' : ''}`}
                        placeholder="0" />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-right text-slate-600">
                      {l.netUnitPricePkr > 0 ? l.netUnitPricePkr.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-right font-semibold text-slate-800">
                      {l.totalPkr > 0 ? l.totalPkr.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={l.salesTaxPct} onChange={(e) => updateLine(i, { salesTaxPct: e.target.value })}
                        className="border rounded px-2 py-1.5 text-xs w-14 text-right" placeholder="17" />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-right text-slate-500">
                      {l.salesTaxPkr > 0 ? l.salesTaxPkr.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={l.landedCostRefPkr} onChange={(e) => updateLine(i, { landedCostRefPkr: e.target.value })}
                        className="border rounded px-2 py-1.5 text-xs w-24 text-right text-slate-400" placeholder="Cost ref" />
                    </td>
                    <td className="px-3 py-2 text-xs text-right">
                      {l.marginPct !== null && (
                        <span className={`flex items-center justify-end gap-0.5 font-medium ${l.marginPct >= 15 ? 'text-green-600' : l.marginPct >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
                          {l.marginPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {l.marginPct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {lines.length > 1 && (
                        <button onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Discount > 5% warning */}
          {lines.some((l) => parseFloat(l.discountPct || '0') > 5) && (
            <div className="mx-4 my-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              Discount &gt; 5% — requires Sales Manager approval before sending to customer.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="flex justify-end">
        <Card className="w-80">
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Sub-total</span>
              <span className="font-mono">{pkr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Sales Tax</span>
              <span className="font-mono">{pkr(totalTax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-800 border-t pt-2">
              <span>Grand Total</span>
              <span className="font-mono">{pkr(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>WHT deductible ({selectedCustomer?.whtRatePct ?? '4.5'}%)</span>
              <span className="font-mono">-{pkr(whtPkr)}</span>
            </div>
            <div className="flex justify-between text-xs text-teal-700 font-medium border-t pt-2">
              <span>Net payable after WHT</span>
              <span className="font-mono">{pkr(netPayable)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Save as Draft
        </Button>
      </div>
    </div>
  );
}
