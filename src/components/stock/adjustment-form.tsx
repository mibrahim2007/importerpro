'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface Product { id: string; code: string | null; name: string; uom: string }
interface Warehouse { id: string; name: string }
interface Location { id: string; warehouseId: string; name: string }

interface Props { products: Product[]; warehouses: Warehouse[]; locations: Location[] }

const REASON_CODES = [
  { value: 'count_correction', label: 'Physical Count Correction' },
  { value: 'damage', label: 'Damage' },
  { value: 'spillage', label: 'Spillage / Loss' },
  { value: 'sampling', label: 'Sampling / Testing' },
  { value: 'expired', label: 'Expired / Disposed' },
  { value: 'other', label: 'Other' },
];

export function AdjustmentForm({ products, warehouses, locations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [lotBatchNo, setLotBatchNo] = useState('');
  const [qtyStr, setQtyStr] = useState('');
  const [isNegative, setIsNegative] = useState(true);
  const [uom, setUom] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [notes, setNotes] = useState('');
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredLocations = useMemo(() => locations.filter((l) => l.warehouseId === warehouseId), [locations, warehouseId]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) setUom(prod.uom);
  };

  const qty = parseFloat(qtyStr) || 0;
  const finalQty = isNegative ? -Math.abs(qty) : Math.abs(qty);

  const handleSubmit = async () => {
    if (!warehouseId || !productId) return toast.error('Warehouse and product are required');
    if (!qty || qty <= 0) return toast.error('Enter a valid quantity');
    if (!reasonCode) return toast.error('Select a reason code');

    setLoading(true);
    try {
      const res = await fetch('/api/stock/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjDate, warehouseId, locationId: locationId || null, productId, lotBatchNo: lotBatchNo || null, qty: finalQty, uom: uom || null, reasonCode, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { adjustment } = await res.json();
      toast.success(`Adjustment ${adjustment.adjNo} posted`);
      router.push('/warehouse/adjustments');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Adjustment Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date *</label>
            <input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Warehouse *</label>
            <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setLocationId(''); }} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {filteredLocations.length > 0 && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Location</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Any location</option>
                {filteredLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Product *</label>
            <select value={productId} onChange={(e) => handleProductChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Lot / Batch</label>
            <input value={lotBatchNo} onChange={(e) => setLotBatchNo(e.target.value)} placeholder="Optional" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Reason *</label>
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select reason…</option>
              {REASON_CODES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Qty + direction toggle */}
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-2">Adjustment Type & Quantity *</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setIsNegative(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${isNegative ? 'bg-red-50 border-red-300 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <TrendingDown className="h-4 w-4" /> Decrease (Write-off)
              </button>
              <button onClick={() => setIsNegative(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${!isNegative ? 'bg-green-50 border-green-300 text-green-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <TrendingUp className="h-4 w-4" /> Increase (Add)
              </button>
            </div>
            <div className="flex gap-2">
              <input type="number" min="0" step="0.001" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)}
                placeholder="0.000" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <input value={uom} onChange={(e) => setUom(e.target.value)} placeholder="UOM" className="w-24 border rounded-lg px-3 py-2 text-sm" />
            </div>
            {qty > 0 && (
              <p className={`mt-1.5 text-sm font-medium ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                {isNegative ? '−' : '+'}{qty.toLocaleString()} {uom}
                {isNegative ? ' will be deducted from stock' : ' will be added to stock'}
              </p>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Post Adjustment
        </Button>
      </div>
    </div>
  );
}
