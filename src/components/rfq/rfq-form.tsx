'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, X, Check, Send, Save } from 'lucide-react';

interface Product { id: string; name: string; code?: string | null; uom?: string | null; hsCode?: string | null }
interface IndentLine { id: string; productId: string; qty: string; uom?: string | null; specifications?: string | null; estPriceUsd?: string | null }
interface Supplier { id: string; name: string; code?: string | null; supplierType?: string | null }

interface Props {
  indentId?: string;
  indentNo?: string;
  indentLines?: (IndentLine & { product: Product | null })[];
  suppliers: Supplier[];
}

interface FormLine {
  productId: string;
  productName: string;
  qty: number;
  uom: string;
  specGrade: string;
  targetPrice: string;
  sortOrder: number;
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
];

export function RfqForm({ indentId, indentNo, indentLines = [], suppliers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'draft' | 'send' | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');

  const [header, setHeader] = useState({
    validUntil: '',
    incoterms: 'CIF',
    portOfDischarge: '',
    currency: 'USD',
    paymentTerms: 'lc_sight',
    exchangeRate: '',
  });

  const [lines, setLines] = useState<FormLine[]>(
    indentLines.length > 0
      ? indentLines.map((l, i) => ({
          productId: l.productId,
          productName: l.product?.name ?? l.productId,
          qty: Number(l.qty),
          uom: l.uom ?? l.product?.uom ?? 'MT',
          specGrade: l.specifications ?? '',
          targetPrice: l.estPriceUsd ?? '',
          sortOrder: i,
        }))
      : []
  );

  const updateLine = (i: number, field: keyof FormLine, val: any) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));

  const toggleSupplier = (id: string) =>
    setSelectedSuppliers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.code?.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const submit = async (action: 'draft' | 'send') => {
    if (selectedSuppliers.length === 0) { toast.error('Select at least one supplier'); return; }
    if (lines.length === 0) { toast.error('At least one line item required'); return; }

    setLoading(action);
    try {
      const res = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indentId,
          validUntil: header.validUntil || undefined,
          incoterms: header.incoterms,
          portOfDischarge: header.portOfDischarge || undefined,
          currency: header.currency,
          paymentTerms: header.paymentTerms || undefined,
          exchangeRate: header.exchangeRate ? Number(header.exchangeRate) : undefined,
          supplierIds: selectedSuppliers,
          lines: lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            uom: l.uom,
            specGrade: l.specGrade || undefined,
            targetPrice: l.targetPrice ? Number(l.targetPrice) : undefined,
            sortOrder: l.sortOrder,
          })),
          action,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create RFQ');
      const rfq = await res.json();
      toast.success(action === 'send' ? 'RFQ created and sent' : 'RFQ saved as draft');
      router.push(`/import/rfqs/${rfq.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header fields */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">RFQ Terms</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Valid Until</Label>
            <Input type="date" value={header.validUntil}
              onChange={(e) => setHeader((h) => ({ ...h, validUntil: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Incoterms</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={header.incoterms}
              onChange={(e) => setHeader((h) => ({ ...h, incoterms: e.target.value }))}>
              {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port of Discharge</Label>
            <Input placeholder="Karachi / Port Qasim"
              value={header.portOfDischarge}
              onChange={(e) => setHeader((h) => ({ ...h, portOfDischarge: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={header.currency}
              onChange={(e) => setHeader((h) => ({ ...h, currency: e.target.value }))}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Terms</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={header.paymentTerms}
              onChange={(e) => setHeader((h) => ({ ...h, paymentTerms: e.target.value }))}>
              {PAYMENT_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exchange Rate (PKR per {header.currency})</Label>
            <Input type="number" placeholder="278.50"
              value={header.exchangeRate}
              onChange={(e) => setHeader((h) => ({ ...h, exchangeRate: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Line Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-3 py-2.5 font-medium text-slate-600">Product</th>
                <th className="text-right px-3 py-2.5 font-medium text-slate-600 w-24">Qty</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-600 w-24">UOM</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-600">Grade / Spec</th>
                <th className="text-right px-3 py-2.5 font-medium text-slate-600 w-32">Target Price (USD)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{line.productName}</td>
                  <td className="px-3 py-2.5">
                    <Input type="number" className="text-right w-24"
                      value={line.qty}
                      onChange={(e) => updateLine(i, 'qty', Number(e.target.value))} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input className="w-20" value={line.uom}
                      onChange={(e) => updateLine(i, 'uom', e.target.value)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input placeholder="e.g. Food Grade, 99.5% purity"
                      value={line.specGrade}
                      onChange={(e) => updateLine(i, 'specGrade', e.target.value)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input type="number" className="text-right w-28" placeholder="0.00"
                      value={line.targetPrice}
                      onChange={(e) => updateLine(i, 'targetPrice', e.target.value)} />
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No lines. Create RFQ from an approved indent to pre-fill lines.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Supplier Selection */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Invite Suppliers <span className="text-slate-400 font-normal">({selectedSuppliers.length} selected)</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search suppliers…" value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {filteredSuppliers.map((s) => {
              const selected = selectedSuppliers.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSupplier(s.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    selected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                    selected ? 'bg-teal-600 border-teal-600' : 'border-slate-300'
                  }`}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{s.code}</p>
                  </div>
                </button>
              );
            })}
            {filteredSuppliers.length === 0 && (
              <p className="col-span-2 text-sm text-slate-400 py-4 text-center">No suppliers found</p>
            )}
          </div>
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
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => submit('send')} disabled={!!loading}>
          {loading === 'send' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Create &amp; Send RFQ
        </Button>
      </div>
    </div>
  );
}
