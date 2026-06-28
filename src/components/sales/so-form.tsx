'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react';

interface Customer {
  id: string; name: string; code: string | null;
  salesTaxCategory: string | null; whtRatePct: string | null;
  paymentTerms: string | null; creditLimitPkr: string | null;
}
interface Product { id: string; name: string; code: string | null; uom: string | null }
interface Warehouse { id: string; name: string; branchId: string }
interface PrefillLine {
  productId: string; orderedQty: string | null; uom: string | null;
  unitPricePkr: string | null; discountPct: string | null;
  salesTaxPct: string | null; productName?: string | null; productCode?: string | null;
}
interface StockRow { productId: string; warehouseId: string; available: number }

interface Props {
  customers: Customer[]; products: Product[]; warehouses: Warehouse[];
  prefillCustomerId?: string; prefillQuotationId?: string;
  prefillLines?: PrefillLine[]; prefillPaymentTerms?: string;
}

interface Line {
  productId: string; orderedQty: string; uom: string;
  unitPricePkr: string; discountPct: string; salesTaxPct: string;
  netUnitPricePkr: number; totalPkr: number; salesTaxPkr: number;
}

const TODAY = new Date().toISOString().split('T')[0];
const BLANK = (): Line => ({
  productId: '', orderedQty: '', uom: '', unitPricePkr: '',
  discountPct: '0', salesTaxPct: '17',
  netUnitPricePkr: 0, totalPkr: 0, salesTaxPkr: 0,
});

const calc = (l: Line): Line => {
  const unit = parseFloat(l.unitPricePkr || '0');
  const disc = parseFloat(l.discountPct || '0');
  const qty = parseFloat(l.orderedQty || '0');
  const tax = parseFloat(l.salesTaxPct || '0');
  const netUnit = unit * (1 - disc / 100);
  const total = netUnit * qty;
  return { ...l, netUnitPricePkr: netUnit, totalPkr: total, salesTaxPkr: total * (tax / 100) };
};

const pkr = (n: number) => `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalesOrderForm({
  customers, products, warehouses,
  prefillCustomerId = '', prefillQuotationId,
  prefillLines = [], prefillPaymentTerms = 'net_30',
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [warehouseId, setWarehouseId] = useState('');
  const [stock, setStock] = useState<StockRow[]>([]);
  const [form, setForm] = useState({
    soDate: TODAY, paymentTerms: prefillPaymentTerms,
    requestedDeliveryDate: '', promisedDeliveryDate: '', internalNotes: '',
  });
  const [lines, setLines] = useState<Line[]>(
    prefillLines.length
      ? prefillLines.map((pl) => calc({
          ...BLANK(),
          productId: pl.productId,
          orderedQty: pl.orderedQty ?? '',
          uom: pl.uom ?? '',
          unitPricePkr: pl.unitPricePkr ?? '',
          discountPct: pl.discountPct ?? '0',
          salesTaxPct: pl.salesTaxPct ?? '17',
        }))
      : [BLANK()]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  useEffect(() => {
    if (!warehouseId) return;
    fetch(`/api/sales/stock-availability?warehouseId=${warehouseId}`)
      .then((r) => r.json())
      .then(setStock)
      .catch(() => {});
  }, [warehouseId]);

  const getAvailable = (productId: string) => {
    if (!warehouseId) return null;
    return stock.find((s) => s.productId === productId && s.warehouseId === warehouseId)?.available ?? 0;
  };

  const onCustomerChange = (id: string) => {
    setCustomerId(id);
    const c = customers.find((c) => c.id === id);
    if (c?.paymentTerms) setForm((p) => ({ ...p, paymentTerms: c.paymentTerms! }));
    const isTaxRegistered = c?.salesTaxCategory && c.salesTaxCategory !== 'non_filer';
    setLines((prev) => prev.map((l) => calc({ ...l, salesTaxPct: isTaxRegistered ? '17' : '0' })));
  };

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? calc({ ...l, ...patch }) : l));

  const onProductChange = (i: number, productId: string) => {
    const p = products.find((p) => p.id === productId);
    updateLine(i, { productId, uom: p?.uom ?? '' });
  };

  const subtotal = lines.reduce((s, l) => s + l.totalPkr, 0);
  const totalTax = lines.reduce((s, l) => s + l.salesTaxPkr, 0);
  const grand = subtotal + totalTax;
  const whtRate = parseFloat(selectedCustomer?.whtRatePct ?? '4.5') / 100;
  const whtPkr = grand * whtRate;
  const creditLimit = parseFloat(selectedCustomer?.creditLimitPkr ?? '0');
  const creditWarn = creditLimit > 0 && grand > creditLimit;

  const handleSave = async () => {
    if (!customerId) return toast.error('Select a customer');
    if (!lines.some((l) => l.productId && parseFloat(l.orderedQty || '0') > 0))
      return toast.error('Add at least one product line with quantity');
    setSaving(true);
    try {
      const res = await fetch('/api/sales/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, customerId, warehouseId: warehouseId || null,
          quotationId: prefillQuotationId || null,
          lines: lines.filter((l) => l.productId && parseFloat(l.orderedQty || '0') > 0),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(`Sales Order ${data.soNo} created`);
      router.push(`/sales/orders/${data.id}`);
    } catch { toast.error('Failed to create order'); }
    finally { setSaving(false); }
  };

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Order Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Customer *</label>
            <select value={customerId} onChange={(e) => onCustomerChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>)}
            </select>
            {selectedCustomer && (
              <p className="mt-1 text-xs text-slate-400">
                WHT {selectedCustomer.whtRatePct ?? '4.5'}% · Limit PKR {parseFloat(selectedCustomer.creditLimitPkr ?? '0').toLocaleString('en-PK', { maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">SO Date *</label>
            <input type="date" value={form.soDate} onChange={(e) => setF('soDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Terms</label>
            <select value={form.paymentTerms} onChange={(e) => setF('paymentTerms', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {['advance', 'cod', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'].map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ').replace('net', 'Net')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dispatching Warehouse</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Customer Req. Date</label>
            <input type="date" value={form.requestedDeliveryDate} onChange={(e) => setF('requestedDeliveryDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Promised Delivery Date</label>
            <input type="date" value={form.promisedDeliveryDate} onChange={(e) => setF('promisedDeliveryDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-slate-500 mb-1">Internal Notes</label>
            <textarea rows={2} value={form.internalNotes} onChange={(e) => setF('internalNotes', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Credit warning */}
      {creditWarn && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
          <span className="font-semibold">Credit Warning:</span>
          Order value {pkr(grand)} exceeds credit limit {pkr(creditLimit)}. Order will go to Finance approval on confirmation.
        </div>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Order Lines</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, BLANK()])}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Line
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  {['Product', 'Ordered Qty', 'UOM', 'Unit Price', 'Disc %', 'Net Price', 'Total', 'Tax %', 'Stock Avail.', ''].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const avail = l.productId ? getAvailable(l.productId) : null;
                  const orderedQtyNum = parseFloat(l.orderedQty || '0');
                  const stockShort = avail !== null && orderedQtyNum > avail;
                  return (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">
                        <select value={l.productId} onChange={(e) => onProductChange(i, e.target.value)} className="border rounded px-2 py-1.5 text-xs w-40">
                          <option value="">Select…</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.orderedQty} onChange={(e) => updateLine(i, { orderedQty: e.target.value })}
                          className={`border rounded px-2 py-1.5 text-xs w-20 text-right ${stockShort ? 'border-amber-400 bg-amber-50' : ''}`} placeholder="0" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.uom} onChange={(e) => updateLine(i, { uom: e.target.value })} className="border rounded px-2 py-1.5 text-xs w-14" placeholder="KG" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.unitPricePkr} onChange={(e) => updateLine(i, { unitPricePkr: e.target.value })}
                          className="border rounded px-2 py-1.5 text-xs w-28 text-right font-mono" placeholder="0.00" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.discountPct} onChange={(e) => updateLine(i, { discountPct: e.target.value })}
                          className="border rounded px-2 py-1.5 text-xs w-16 text-right" placeholder="0" />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-right text-slate-600">
                        {l.netUnitPricePkr > 0 ? l.netUnitPricePkr.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-right font-semibold">
                        {l.totalPkr > 0 ? l.totalPkr.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.salesTaxPct} onChange={(e) => updateLine(i, { salesTaxPct: e.target.value })}
                          className="border rounded px-2 py-1.5 text-xs w-14 text-right" placeholder="17" />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {avail !== null ? (
                          <span className={`flex items-center gap-1 ${stockShort ? 'text-amber-600 font-medium' : 'text-green-600'}`}>
                            <Package className="h-3 w-3" />
                            {avail.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                            {stockShort && <span className="text-[10px]">(backorder)</span>}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="flex justify-end">
        <Card className="w-80">
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600"><span>Sub-total</span><span className="font-mono">{pkr(subtotal)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Sales Tax</span><span className="font-mono">{pkr(totalTax)}</span></div>
            <div className="flex justify-between font-semibold text-slate-800 border-t pt-2"><span>Grand Total</span><span className="font-mono">{pkr(grand)}</span></div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>WHT deductible ({selectedCustomer?.whtRatePct ?? '4.5'}%)</span>
              <span className="font-mono">-{pkr(whtPkr)}</span>
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
