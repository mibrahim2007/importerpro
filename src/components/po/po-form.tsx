'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';

interface Product { id: string; name: string; code?: string | null; hsCode?: string | null; uom?: string | null }
interface Supplier { id: string; name: string; code?: string | null }

export interface PoLine {
  productId: string;
  productName: string;
  hsCode: string;
  qty: number;
  uom: string;
  unitPrice: number;
}

interface Props {
  suppliers: Supplier[];
  products: Product[];
  rfqId?: string;
  indentId?: string;
  // Pre-filled from RFQ
  initialSupplierId?: string;
  initialLines?: PoLine[];
  initialIncoterms?: string;
  initialCurrency?: string;
  initialPaymentTerms?: string;
  initialPortOfDischarge?: string;
  initialExchangeRate?: string;
}

const INCOTERMS = ['CIF', 'FOB', 'CFR', 'EXW', 'DDP'];
const CURRENCIES = ['USD', 'EUR', 'CNY', 'AED', 'GBP', 'PKR'];
const PAYMENT_TERMS = [
  { value: 'lc_sight', label: 'LC at Sight' },
  { value: 'lc_30', label: 'LC 30 days' },
  { value: 'lc_60', label: 'LC 60 days' },
  { value: 'lc_90', label: 'LC 90 days' },
  { value: 'tt_advance', label: 'TT Advance' },
  { value: 'cad', label: 'CAD' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
];

const today = () => new Date().toISOString().split('T')[0];

export function PoForm({
  suppliers,
  products,
  rfqId,
  indentId,
  initialSupplierId = '',
  initialLines = [],
  initialIncoterms = 'CIF',
  initialCurrency = 'USD',
  initialPaymentTerms = 'lc_sight',
  initialPortOfDischarge = '',
  initialExchangeRate = '',
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'draft' | 'confirm' | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const [header, setHeader] = useState({
    supplierId: initialSupplierId,
    poDate: today(),
    incoterms: initialIncoterms,
    portOfLoading: '',
    portOfDischarge: initialPortOfDischarge,
    paymentTerms: initialPaymentTerms,
    currency: initialCurrency,
    exchangeRate: initialExchangeRate,
    latestShipDate: '',
    lcExpiryDate: '',
    bankIssuingLc: '',
  });

  const [freight, setFreight] = useState({ freightAmount: '0', insuranceAmount: '0' });
  const [notes, setNotes] = useState({ packingInstructions: '', markingInstructions: '', specialConditions: '' });
  const [lines, setLines] = useState<PoLine[]>(initialLines);

  const h = (field: keyof typeof header) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setHeader((prev) => ({ ...prev, [field]: e.target.value }));

  const updateLine = (i: number, field: keyof PoLine, val: any) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const addProduct = (product: Product) => {
    if (lines.find((l) => l.productId === product.id)) return;
    setLines((prev) => [...prev, {
      productId: product.id,
      productName: product.name,
      hsCode: product.hsCode ?? '',
      qty: 1,
      uom: product.uom ?? 'MT',
      unitPrice: 0,
    }]);
    setProductSearch('');
  };

  const subtotal = useMemo(() =>
    lines.reduce((s, l) => s + Number(l.qty) * Number(l.unitPrice || 0), 0),
    [lines]
  );
  const cifUsd = subtotal + Number(freight.freightAmount || 0) + Number(freight.insuranceAmount || 0);
  const cifPkr = header.exchangeRate ? cifUsd * Number(header.exchangeRate) : 0;

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const submit = async (action: 'draft' | 'confirm') => {
    if (!header.supplierId) { toast.error('Select a supplier'); return; }
    if (lines.length === 0) { toast.error('Add at least one product'); return; }
    if (lines.some((l) => !l.unitPrice || l.unitPrice <= 0)) { toast.error('All lines need a unit price'); return; }

    setLoading(action);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...header,
          ...freight,
          ...notes,
          rfqId,
          indentId,
          exchangeRate: header.exchangeRate ? Number(header.exchangeRate) : undefined,
          freightAmount: Number(freight.freightAmount || 0),
          insuranceAmount: Number(freight.insuranceAmount || 0),
          lines: lines.map((l, i) => ({
            productId: l.productId,
            hsCode: l.hsCode || undefined,
            qty: Number(l.qty),
            uom: l.uom || undefined,
            unitPrice: Number(l.unitPrice),
            sortOrder: i,
          })),
          action,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create PO');
      const po = await res.json();
      toast.success(action === 'confirm' ? 'PO confirmed' : 'PO saved as draft');
      router.push(`/import/purchase-orders/${po.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      {/* Commercial Terms */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Commercial Terms</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Supplier <span className="text-red-500">*</span></Label>
            <select
              className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={header.supplierId} onChange={h('supplierId')}
              disabled={!!initialSupplierId}
            >
              <option value="">— Select Supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">PO Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={header.poDate} onChange={h('poDate')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Incoterms</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={header.incoterms} onChange={h('incoterms')}>
              {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port of Loading</Label>
            <Input placeholder="Shanghai" value={header.portOfLoading} onChange={h('portOfLoading')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port of Discharge</Label>
            <Input placeholder="Karachi / Port Qasim" value={header.portOfDischarge} onChange={h('portOfDischarge')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Terms</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={header.paymentTerms} onChange={h('paymentTerms')}>
              {PAYMENT_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={header.currency} onChange={h('currency')}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exchange Rate (PKR)</Label>
            <Input type="number" placeholder="278.50" value={header.exchangeRate} onChange={h('exchangeRate')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Latest Ship Date</Label>
            <Input type="date" value={header.latestShipDate} onChange={h('latestShipDate')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">LC Expiry Date</Label>
            <Input type="date" value={header.lcExpiryDate} onChange={h('lcExpiryDate')} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Issuing Bank (LC)</Label>
            <Input placeholder="Habib Bank Limited — Corporate Branch" value={header.bankIssuingLc} onChange={h('bankIssuingLc')} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Line Items</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Search and add product…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            {productSearch && filteredProducts.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredProducts.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left"
                    onClick={() => addProduct(p)}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.code} · {p.hsCode}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 w-28">HS Code</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 w-24">Qty</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 w-20">UOM</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{line.productName}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Input className="w-28 font-mono text-xs" placeholder="8401.1010"
                          value={line.hsCode}
                          onChange={(e) => updateLine(i, 'hsCode', e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" className="text-right w-24"
                          value={line.qty}
                          onChange={(e) => updateLine(i, 'qty', Number(e.target.value))} />
                      </td>
                      <td className="px-3 py-2">
                        <Input className="w-20" value={line.uom}
                          onChange={(e) => updateLine(i, 'uom', e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" step="0.0001" className="text-right w-28" placeholder="0.0000"
                          value={line.unitPrice || ''}
                          onChange={(e) => updateLine(i, 'unitPrice', Number(e.target.value))} />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        ${(Number(line.qty) * Number(line.unitPrice || 0)).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => removeLine(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lines.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Search for products above to add line items</p>
          )}
        </CardContent>
      </Card>

      {/* Freight & Insurance + CIF Summary */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Freight &amp; Insurance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Freight Amount ({header.currency})</Label>
              <Input type="number" step="0.01" placeholder="0.00"
                value={freight.freightAmount}
                onChange={(e) => setFreight((f) => ({ ...f, freightAmount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Insurance Amount ({header.currency})</Label>
              <Input type="number" step="0.01" placeholder="0.00"
                value={freight.insuranceAmount}
                onChange={(e) => setFreight((f) => ({ ...f, insuranceAmount: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border p-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Subtotal</p>
              <p className="font-semibold text-slate-800 mt-1">
                {header.currency} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">CIF Value ({header.currency})</p>
              <p className="font-bold text-teal-700 mt-1 text-base">
                {cifUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {cifPkr > 0 && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">CIF Value (PKR)</p>
                <p className="font-bold text-slate-700 mt-1 text-base">
                  ₨ {cifPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Shipping Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { field: 'packingInstructions', label: 'Packing Instructions' },
            { field: 'markingInstructions', label: 'Marking & Labelling' },
            { field: 'specialConditions', label: 'Special Conditions' },
          ].map(({ field, label }) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input placeholder={`${label}…`}
                value={(notes as any)[field]}
                onChange={(e) => setNotes((n) => ({ ...n, [field]: e.target.value }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} disabled={!!loading}>
          Cancel
        </Button>
        <Button variant="outline" onClick={() => submit('draft')} disabled={!!loading}>
          {loading === 'draft' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save Draft
        </Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => submit('confirm')} disabled={!!loading}>
          {loading === 'confirm' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Confirm PO
        </Button>
      </div>
    </div>
  );
}
