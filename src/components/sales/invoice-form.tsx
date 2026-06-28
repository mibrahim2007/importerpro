'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface CustomerOption {
  id: string; name: string; code: string | null; ntn: string | null; strn: string | null;
  paymentTerms: string | null; whtRatePct: string | null; salesTaxCategory: string | null;
}

interface InvoiceLine {
  dcLineId: string; productId: string; hsCode: string; description: string;
  qty: string; uom: string; unitPricePkr: string; discountPkr: string;
  salesTaxPct: string; taxableValuePkr: number; salesTaxPkr: number;
}

const PAYMENT_TERMS = ['advance', 'cod', 'net_7', 'net_30', 'net_60', 'net_90'];
const INV_TYPES = [
  { value: 'tax_invoice', label: 'Tax Invoice' },
  { value: 'simplified_invoice', label: 'Simplified Invoice' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
];
const TODAY = new Date().toISOString().split('T')[0];

function calcLine(l: InvoiceLine) {
  const qty = parseFloat(l.qty || '0');
  const unit = parseFloat(l.unitPricePkr || '0');
  const disc = parseFloat(l.discountPkr || '0');
  const taxPct = parseFloat(l.salesTaxPct || '17');
  const taxable = qty * unit - disc;
  const taxAmt = taxable * (taxPct / 100);
  return { taxableValuePkr: taxable, salesTaxPkr: taxAmt };
}

function blankLine(): InvoiceLine {
  return { dcLineId: '', productId: '', hsCode: '', description: '', qty: '', uom: '', unitPricePkr: '', discountPkr: '0', salesTaxPct: '17', taxableValuePkr: 0, salesTaxPkr: 0 };
}

export function InvoiceForm({ customers, prefillDc, prefillSo }: {
  customers: CustomerOption[]; prefillDc?: any; prefillSo?: any;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoiceDate: TODAY,
    invoiceType: 'tax_invoice',
    customerId: prefillDc?.customerId ?? prefillSo?.customerId ?? '',
    paymentTerms: 'net_30',
    internalNotes: '',
    termsConditions: 'Payment within 30 days. Cheques subject to clearance.',
  });
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  // Pre-fill from DC
  useEffect(() => {
    if (!prefillDc) return;
    setForm((f) => ({ ...f, customerId: prefillDc.customerId }));
    setLines(prefillDc.lines.map((l: any) => ({
      dcLineId: l.id, productId: l.productId ?? '',
      hsCode: l.hsCode ?? '', description: l.productName ?? '',
      qty: l.dispatchedQty, uom: l.uom ?? '', unitPricePkr: '', discountPkr: '0', salesTaxPct: '17',
      taxableValuePkr: 0, salesTaxPkr: 0,
    })));
  }, []);

  // When customer changes, set payment terms from customer defaults
  const selectedCustomer = customers.find((c) => c.id === form.customerId);
  useEffect(() => {
    if (selectedCustomer?.paymentTerms) {
      setForm((f) => ({ ...f, paymentTerms: selectedCustomer.paymentTerms! }));
    }
  }, [form.customerId]);

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setLine = (i: number, k: string, v: string) => {
    setLines((prev) => {
      const updated = prev.map((l, idx) => {
        if (idx !== i) return l;
        const nl = { ...l, [k]: v };
        const calc = calcLine(nl);
        return { ...nl, ...calc };
      });
      return updated;
    });
  };

  const addLine = () => setLines((p) => [...p, blankLine()]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((s, l) => s + l.taxableValuePkr, 0);
  const totalTax = lines.reduce((s, l) => s + l.salesTaxPkr, 0);
  const grandTotal = subtotal + totalTax;
  const whtPct = parseFloat(String(selectedCustomer?.whtRatePct ?? '0'));
  const whtAmt = grandTotal * (whtPct / 100);
  const netPayable = grandTotal - whtAmt;

  const handleSave = async () => {
    if (!form.customerId) return toast.error('Select a customer');
    if (!lines.length) return toast.error('Add at least one line item');
    setSaving(true);
    try {
      const res = await fetch('/api/sales/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          dcId: prefillDc?.id ?? null,
          soId: prefillDc?.soId ?? prefillSo?.id ?? null,
          lines: lines.map((l) => ({
            dcLineId: l.dcLineId || null, productId: l.productId || null,
            hsCode: l.hsCode, description: l.description,
            qty: l.qty, uom: l.uom, unitPricePkr: l.unitPricePkr,
            discountPkr: l.discountPkr, salesTaxPct: l.salesTaxPct,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(`Invoice ${data.invoiceNo} created`);
      router.push(`/sales/invoices/${data.id}`);
    } catch { toast.error('Failed to create invoice'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Invoice Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Customer *</label>
            <select value={form.customerId} onChange={(e) => setF('customerId', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
            </select>
            {selectedCustomer && (
              <div className="mt-1 flex gap-4 text-xs text-slate-400">
                {selectedCustomer.ntn && <span>NTN: {selectedCustomer.ntn}</span>}
                {selectedCustomer.strn && <span>STRN: {selectedCustomer.strn}</span>}
                {selectedCustomer.salesTaxCategory === 'registered' && <span className="text-green-600">ST Registered</span>}
                {whtPct > 0 && <span className="text-amber-600">WHT: {whtPct}%</span>}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Invoice Date *</label>
            <input type="date" value={form.invoiceDate} onChange={(e) => setF('invoiceDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Invoice Type</label>
            <select value={form.invoiceType} onChange={(e) => setF('invoiceType', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {INV_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Terms</label>
            <select value={form.paymentTerms} onChange={(e) => setF('paymentTerms', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm capitalize">
              {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Internal Notes</label>
            <input value={form.internalNotes} onChange={(e) => setF('internalNotes', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Terms & Conditions</label>
            <textarea rows={2} value={form.termsConditions} onChange={(e) => setF('termsConditions', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Line Items</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No items yet — add a line above</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['Description', 'HS Code', 'Qty', 'UOM', 'Unit Price (PKR)', 'Discount (PKR)', 'Taxable Value', 'ST %', 'Sales Tax', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">
                        <input value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-40" placeholder="Product / description" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.hsCode} onChange={(e) => setLine(i, 'hsCode', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-24 font-mono" placeholder="28151100" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-20 text-right" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.uom} onChange={(e) => setLine(i, 'uom', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-16" placeholder="KG" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.unitPricePkr} onChange={(e) => setLine(i, 'unitPricePkr', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-28 text-right" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.discountPkr} onChange={(e) => setLine(i, 'discountPkr', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-24 text-right" />
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-right text-slate-700">
                        {l.taxableValuePkr.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.salesTaxPct} onChange={(e) => setLine(i, 'salesTaxPct', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-16 text-right" />
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-right text-blue-700">
                        {l.salesTaxPkr.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      {lines.length > 0 && (
        <div className="flex justify-end">
          <div className="w-72 space-y-2 border rounded-xl bg-white p-4 text-sm">
            <div className="flex justify-between text-slate-500"><span>Taxable Sub-total</span><span>PKR {subtotal.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between text-blue-700"><span>Sales Tax</span><span>PKR {totalTax.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between font-bold text-slate-900 border-t pt-2"><span>Grand Total</span><span>PKR {grandTotal.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
            {whtAmt > 0 && (
              <>
                <div className="flex justify-between text-amber-600 text-xs"><span>WHT (Sec. 153 @ {whtPct}%)</span><span>- PKR {whtAmt.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between font-bold text-teal-700 border-t pt-2"><span>Net Payable</span><span>PKR {netPayable.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Save Invoice
        </Button>
      </div>
    </div>
  );
}
