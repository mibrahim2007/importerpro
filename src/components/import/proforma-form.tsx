'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Info } from 'lucide-react';

interface PO { id: string; poNo: string; supplierId: string; cifValueUsd: string | null; incoterms: string | null; currency: string | null; portOfLoading: string | null; portOfDischarge: string | null; }
interface Supplier { id: string; name: string; country: string | null; }
interface PoLine { id: string; productId: string | null; hsCode: string | null; qty: string; uom: string | null; unitPrice: string; totalPrice: string | null; productName: string | null; }

export function ProformaForm({
  purchaseOrders, suppliers, preloadedPoId, preloadedLines = [],
}: {
  purchaseOrders: PO[];
  suppliers: Supplier[];
  preloadedPoId?: string;
  preloadedLines?: PoLine[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [poId, setPoId] = useState(preloadedPoId ?? '');
  const [piNo, setPiNo] = useState('');
  const [piDate, setPiDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('280');
  const [validityDate, setValidityDate] = useState('');
  const [estimatedShipDate, setEstimatedShipDate] = useState('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [incoterms, setIncoterms] = useState('CIF');
  const [freightAmount, setFreightAmount] = useState('0');
  const [insuranceAmount, setInsuranceAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{
    poLineId: string; productId: string; hsCode: string; description: string;
    qty: string; uom: string; unitPrice: string;
  }>>(
    preloadedLines.map((l) => ({
      poLineId: l.id,
      productId: l.productId ?? '',
      hsCode: l.hsCode ?? '',
      description: l.productName ?? '',
      qty: String(l.qty),
      uom: l.uom ?? '',
      unitPrice: String(l.unitPrice),
    }))
  );

  const selectedPO = purchaseOrders.find((p) => p.id === poId);
  const supplierId = selectedPO?.supplierId ?? '';

  const onPoChange = (id: string) => {
    setPoId(id);
    const po = purchaseOrders.find((p) => p.id === id);
    if (po) {
      if (po.incoterms) setIncoterms(po.incoterms);
      if (po.portOfLoading) setPortOfLoading(po.portOfLoading);
      if (po.portOfDischarge) setPortOfDischarge(po.portOfDischarge);
    }
  };

  const totalFob = lines.reduce((s, l) => s + parseFloat(l.qty || '0') * parseFloat(l.unitPrice || '0'), 0);
  const totalCif = totalFob + parseFloat(freightAmount || '0') + parseFloat(insuranceAmount || '0');
  const totalPkr = totalCif * parseFloat(exchangeRate || '280');

  const addLine = () => setLines([...lines, { poLineId: '', productId: '', hsCode: '', description: '', qty: '', uom: '', unitPrice: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i));
  const updateLine = (i: number, f: string, v: string) => setLines(lines.map((l, j) => j === i ? { ...l, [f]: v } : l));

  const save = async () => {
    if (!poId || !piNo || !piDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/import/proforma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId, supplierId, piNo, piDate, currency, exchangeRate: parseFloat(exchangeRate),
          validityDate: validityDate || null, estimatedShipDate: estimatedShipDate || null,
          portOfLoading, portOfDischarge, incoterms,
          freightAmount: parseFloat(freightAmount || '0'),
          insuranceAmount: parseFloat(insuranceAmount || '0'),
          notes, lines,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/import/proforma/${data.id}`);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">PI Identity</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Linked Purchase Order *</label>
            <select value={poId} onChange={(e) => onPoChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select PO</option>
              {purchaseOrders.map((p) => <option key={p.id} value={p.id}>{p.poNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Supplier</label>
            <input value={suppliers.find((s) => s.id === supplierId)?.name ?? '—'} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">PI No (Supplier's Ref) *</label>
            <input value={piNo} onChange={(e) => setPiNo(e.target.value)} placeholder="e.g. PI-2026-00123" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">PI Date *</label>
            <input type="date" value={piDate} onChange={(e) => setPiDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Validity Date</label>
            <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Est. Shipment Date</label>
            <input type="date" value={estimatedShipDate} onChange={(e) => setEstimatedShipDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Incoterms</label>
            <select value={incoterms} onChange={(e) => setIncoterms(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {['CIF', 'CFR', 'FOB', 'EXW', 'DDP', 'DAP', 'FCA'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {['USD', 'EUR', 'CNY', 'AED', 'GBP'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Exchange Rate (PKR)</label>
            <input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Port of Loading</label>
            <input value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Shanghai" />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Line Items</h2>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Description *', 'HS Code', 'Qty *', 'UOM', `Unit Price (${currency}) *`, `Total (${currency})`].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-2"><input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" placeholder="Product / commodity" /></td>
                  <td className="px-3 py-2"><input value={l.hsCode} onChange={(e) => updateLine(i, 'hsCode', e.target.value)} className="w-28 border rounded px-2 py-1 text-sm font-mono" placeholder="1234.56.00" /></td>
                  <td className="px-3 py-2"><input type="number" value={l.qty} onChange={(e) => updateLine(i, 'qty', e.target.value)} className="w-24 border rounded px-2 py-1 text-sm text-right" /></td>
                  <td className="px-3 py-2"><input value={l.uom} onChange={(e) => updateLine(i, 'uom', e.target.value)} className="w-16 border rounded px-2 py-1 text-sm" placeholder="MT" /></td>
                  <td className="px-3 py-2"><input type="number" value={l.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} className="w-28 border rounded px-2 py-1 text-sm text-right" /></td>
                  <td className="px-3 py-2 font-semibold text-right pr-4">{(parseFloat(l.qty || '0') * parseFloat(l.unitPrice || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2"><button onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-slate-400 text-sm">No lines — click Add Line</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Freight / Insurance + Totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Freight & Insurance ({currency})</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Freight ({incoterms === 'FOB' ? 'N/A' : currency})</label>
              <input type="number" value={freightAmount} onChange={(e) => setFreightAmount(e.target.value)} disabled={incoterms === 'FOB'} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Insurance ({currency})</label>
              <input type="number" value={insuranceAmount} onChange={(e) => setInsuranceAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Any supplier remarks or special terms..." />
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">PI Totals</h2>
          <div className="space-y-1 pt-2">
            {[
              { label: `FOB Value (${currency})`, value: totalFob },
              { label: `Freight (${currency})`, value: parseFloat(freightAmount || '0') },
              { label: `Insurance (${currency})`, value: parseFloat(insuranceAmount || '0') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm text-slate-300">
                <span>{label}</span>
                <span>{value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-teal-400">
              <span>CIF Value ({currency})</span>
              <span>{totalCif.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400">
              <span>Exchange Rate</span>
              <span>{parseFloat(exchangeRate || '280').toLocaleString('en-PK')} PKR/{currency}</span>
            </div>
            <div className="flex justify-between font-bold text-white text-lg">
              <span>CIF PKR</span>
              <span>PKR {totalPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/import/proforma')}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !poId || !piNo}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Proforma Invoice
        </Button>
      </div>
    </div>
  );
}
