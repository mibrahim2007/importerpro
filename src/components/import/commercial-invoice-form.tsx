'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const INCOTERMS = ['CIF', 'CFR', 'FOB', 'EXW', 'DDP', 'DAP', 'FCA'];
const CURRENCIES = ['USD', 'EUR', 'CNY', 'AED', 'GBP'];

interface PoLine { id: string; productId: string | null; hsCode: string | null; qty: string; uom: string | null; unitPrice: string; productName: string | null; }

export function CommercialInvoiceForm({
  purchaseOrders, suppliers, proformaInvoices, letterOfCredits, shipments,
  preloadedPoId, preloadedPiId, preloadedLines = [],
}: any) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [poId, setPoId] = useState(preloadedPoId ?? '');
  const [piId, setPiId] = useState(preloadedPiId ?? '');
  const [lcId, setLcId] = useState('');
  const [shipmentId, setShipmentId] = useState('');
  const [ciNo, setCiNo] = useState('');
  const [ciDate, setCiDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('280');
  const [incoterms, setIncoterms] = useState('CIF');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [netWeightKg, setNetWeightKg] = useState('');
  const [grossWeightKg, setGrossWeightKg] = useState('');
  const [packageCount, setPackageCount] = useState('');
  const [marksNumbers, setMarksNumbers] = useState('');
  const [freightAmount, setFreightAmount] = useState('0');
  const [insuranceAmount, setInsuranceAmount] = useState('0');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<Array<{
    poLineId: string; productId: string; hsCode: string; description: string;
    qty: string; uom: string; unitPrice: string; poQty: string; poUnitPrice: string;
  }>>(
    preloadedLines.map((l: PoLine) => ({
      poLineId: l.id, productId: l.productId ?? '', hsCode: l.hsCode ?? '',
      description: l.productName ?? '', qty: String(l.qty), uom: l.uom ?? '',
      unitPrice: String(l.unitPrice), poQty: String(l.qty), poUnitPrice: String(l.unitPrice),
    }))
  );

  const selectedPO = purchaseOrders.find((p: any) => p.id === poId);
  const supplierId = selectedPO?.supplierId ?? '';
  const filteredPIs = proformaInvoices.filter((pi: any) => !poId || pi.poId === poId);
  const filteredLCs = letterOfCredits.filter((lc: any) => !poId || lc.poId === poId);

  const onPoChange = (id: string) => {
    setPoId(id);
    setPiId(''); setLcId('');
    const po = purchaseOrders.find((p: any) => p.id === id);
    if (po) {
      if (po.incoterms) setIncoterms(po.incoterms);
      if (po.portOfLoading) setPortOfLoading(po.portOfLoading);
      if (po.portOfDischarge) setPortOfDischarge(po.portOfDischarge);
    }
  };

  // Live variance computation
  const enrichedLines = lines.map((l) => {
    const qty = parseFloat(l.qty || '0');
    const price = parseFloat(l.unitPrice || '0');
    const poQty = parseFloat(l.poQty || '0');
    const poPrice = parseFloat(l.poUnitPrice || '0');
    const qtyVar = poQty > 0 ? ((qty - poQty) / poQty) * 100 : null;
    const priceVar = poPrice > 0 ? ((price - poPrice) / poPrice) * 100 : null;
    const absQ = Math.abs(qtyVar ?? 0);
    const absP = Math.abs(priceVar ?? 0);
    const flag = (absQ > 10 || absP > 5) ? 'violation' : (absQ > 3 || absP > 1) ? 'minor' : 'ok';
    return { ...l, qty, price, poQty, poPrice, qtyVar, priceVar, flag, total: qty * price };
  });

  const totalFob = enrichedLines.reduce((s, l) => s + l.total, 0);
  const totalCif = totalFob + parseFloat(freightAmount || '0') + parseFloat(insuranceAmount || '0');
  const totalPkr = totalCif * parseFloat(exchangeRate || '280');
  const hasViolation = enrichedLines.some((l) => l.flag === 'violation');
  const hasMinor = enrichedLines.some((l) => l.flag === 'minor');

  const addLine = () => setLines([...lines, { poLineId: '', productId: '', hsCode: '', description: '', qty: '', uom: '', unitPrice: '', poQty: '', poUnitPrice: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i));
  const updateLine = (i: number, f: string, v: string) => setLines(lines.map((l, j) => j === i ? { ...l, [f]: v } : l));

  const save = async () => {
    if (!poId || !ciNo || !ciDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/import/commercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId, piId: piId || null, lcId: lcId || null, shipmentId: shipmentId || null,
          supplierId, ciNo, ciDate, currency, exchangeRate: parseFloat(exchangeRate),
          incoterms, portOfLoading, portOfDischarge, countryOfOrigin,
          netWeightKg: netWeightKg || null, grossWeightKg: grossWeightKg || null,
          packageCount: packageCount || null, marksNumbers,
          freightAmount: parseFloat(freightAmount || '0'),
          insuranceAmount: parseFloat(insuranceAmount || '0'),
          notes,
          lines: lines.map((l) => ({
            poLineId: l.poLineId || null, productId: l.productId || null,
            hsCode: l.hsCode || null, description: l.description,
            qty: parseFloat(l.qty || '0'), uom: l.uom || null,
            unitPrice: parseFloat(l.unitPrice || '0'),
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/import/commercial/${data.id}`);
      }
    } finally { setSaving(false); }
  };

  const varFlag = (flag: string, v: number | null) => {
    if (v === null) return null;
    const pct = v.toFixed(1);
    const cls = flag === 'violation' ? 'text-red-600 font-bold' : flag === 'minor' ? 'text-amber-600' : 'text-green-600';
    return <span className={`text-xs ${cls}`}>{v > 0 ? '+' : ''}{pct}%</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">CI Identity</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Linked Purchase Order *</label>
            <select value={poId} onChange={(e) => onPoChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select PO</option>
              {purchaseOrders.map((p: any) => <option key={p.id} value={p.id}>{p.poNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Linked Proforma Invoice</label>
            <select value={piId} onChange={(e) => setPiId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None</option>
              {filteredPIs.map((pi: any) => <option key={pi.id} value={pi.id}>{pi.piNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Linked LC</label>
            <select value={lcId} onChange={(e) => setLcId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None</option>
              {filteredLCs.map((lc: any) => <option key={lc.id} value={lc.id}>{lc.lcNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Linked Shipment</label>
            <select value={shipmentId} onChange={(e) => setShipmentId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None</option>
              {shipments.map((s: any) => <option key={s.id} value={s.id}>{s.shipmentNo} {s.blNo ? `(B/L: ${s.blNo})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">CI No (Supplier's Ref) *</label>
            <input value={ciNo} onChange={(e) => setCiNo(e.target.value)} placeholder="e.g. INV-2026-00123" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">CI Date *</label>
            <input type="date" value={ciDate} onChange={(e) => setCiDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Incoterms</label>
            <select value={incoterms} onChange={(e) => setIncoterms(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Exchange Rate (PKR)</label>
            <input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Country of Origin</label>
            <input value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="China" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Port of Loading</label>
            <input value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Port of Discharge</label>
            <input value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Net Weight (KG)</label>
            <input type="number" value={netWeightKg} onChange={(e) => setNetWeightKg(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Gross Weight (KG)</label>
            <input type="number" value={grossWeightKg} onChange={(e) => setGrossWeightKg(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Package Count</label>
            <input type="number" value={packageCount} onChange={(e) => setPackageCount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Marks & Numbers</label>
            <input value={marksNumbers} onChange={(e) => setMarksNumbers(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. MCL/KHI/2026 1-20" />
          </div>
        </div>
      </div>

      {/* Live Matching Engine Banner */}
      {lines.length > 0 && (
        <div className={`rounded-xl px-4 py-3 flex gap-2 items-center text-sm ${
          hasViolation ? 'bg-red-50 border border-red-200 text-red-700' :
          hasMinor ? 'bg-amber-50 border border-amber-200 text-amber-700' :
          'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {hasViolation ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
          <span>
            {hasViolation
              ? 'LC Violations detected — quantity or price exceeds tolerance (Qty >10% / Price >5%). Review before saving.'
              : hasMinor
              ? 'Minor variances detected (Qty 3-10% / Price 1-5%) — within tolerance but will be flagged.'
              : 'All lines within tolerance — no PO/LC discrepancies.'}
          </span>
        </div>
      )}

      {/* Line Items with live variance */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Line Items — CI vs PO Matching</h2>
            <p className="text-xs text-slate-400">Qty variance {'>'}10% or price variance {'>'}5% = LC Violation (red)</p>
          </div>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Description', 'HS Code', 'CI Qty', 'PO Qty', 'Δ Qty', `CI Price (${currency})`, `PO Price`, 'Δ Price', `Total (${currency})`, 'Flag', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedLines.map((l, i) => (
                <tr key={i} className={`border-b ${l.flag === 'violation' ? 'bg-red-50' : l.flag === 'minor' ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2"><input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} className="w-36 border rounded px-2 py-1 text-sm" /></td>
                  <td className="px-3 py-2"><input value={l.hsCode} onChange={(e) => updateLine(i, 'hsCode', e.target.value)} className="w-24 border rounded px-2 py-1 text-xs font-mono" /></td>
                  <td className="px-3 py-2"><input type="number" value={l.qty} onChange={(e) => updateLine(i, 'qty', e.target.value)} className="w-20 border rounded px-2 py-1 text-sm text-right" /></td>
                  <td className="px-3 py-2 text-slate-400 text-xs text-right">{l.poQty || '—'}</td>
                  <td className="px-3 py-2 text-right">{varFlag(l.flag, l.qtyVar)}</td>
                  <td className="px-3 py-2"><input type="number" value={l.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} className="w-24 border rounded px-2 py-1 text-sm text-right" /></td>
                  <td className="px-3 py-2 text-slate-400 text-xs text-right">{l.poPrice || '—'}</td>
                  <td className="px-3 py-2 text-right">{varFlag(l.flag, l.priceVar)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{l.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2">
                    {l.flag === 'violation' && <span className="text-xs text-red-600 font-bold">VIOLATION</span>}
                    {l.flag === 'minor' && <span className="text-xs text-amber-600">Minor</span>}
                    {l.flag === 'ok' && <span className="text-xs text-green-600">OK</span>}
                  </td>
                  <td className="px-3 py-2"><button onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={11} className="text-center py-6 text-slate-400 text-sm">No lines — click Add Line or select a PO above</td></tr>
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
              <label className="block text-xs text-slate-500 mb-1">Freight ({currency})</label>
              <input type="number" value={freightAmount} onChange={(e) => setFreightAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Insurance ({currency})</label>
              <input type="number" value={insuranceAmount} onChange={(e) => setInsuranceAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">CI Totals</h2>
          {[
            { label: `FOB Value (${currency})`, value: totalFob },
            { label: `Freight (${currency})`, value: parseFloat(freightAmount || '0') },
            { label: `Insurance (${currency})`, value: parseFloat(insuranceAmount || '0') },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm text-slate-300">
              <span>{label}</span><span>{value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-teal-400">
            <span>CIF Value ({currency})</span>
            <span>{totalCif.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-white font-bold text-lg">
            <span>CIF PKR</span>
            <span>PKR {totalPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="pt-2 border-t border-slate-700">
            <div className={`text-xs font-semibold ${hasViolation ? 'text-red-400' : hasMinor ? 'text-amber-400' : 'text-green-400'}`}>
              Match Status: {hasViolation ? '🔴 DISCREPANT' : hasMinor ? '🟡 MINOR VARIANCE' : '🟢 MATCHED'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/import/commercial')}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={saving || !poId || !ciNo}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Commercial Invoice
        </Button>
      </div>
    </div>
  );
}
