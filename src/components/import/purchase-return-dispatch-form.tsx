'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PraLine {
  id: string;
  productId?: string | null;
  description: string;
  returnQty: string | null;
  dispatchedQty?: string | null;
  uom?: string | null;
  lotNo?: string | null;
  unitPrice?: string | null;
  currency?: string | null;
  productName?: string | null;
}
interface Warehouse { id: string; name: string }

interface DispatchLine {
  praLineId: string;
  productId?: string;
  description: string;
  returnQty: string;
  dispatchedQty: string;
  lotNo: string;
  warehouseId: string;
  locationId: string;
  uom: string;
}

interface Props { praId: string; praNo: string; praLines: PraLine[]; warehouses: Warehouse[] }

export function PurchaseReturnDispatchForm({ praId, praNo, praLines, warehouses }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleNo, setVehicleNo] = useState('');
  const [transportCompany, setTransportCompany] = useState('');
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('');

  const [lines, setLines] = useState<DispatchLine[]>(() =>
    praLines.map(l => ({
      praLineId: l.id,
      productId: l.productId ?? undefined,
      description: l.productName ?? l.description,
      returnQty: l.returnQty ?? '',
      dispatchedQty: l.returnQty ?? '',
      lotNo: l.lotNo ?? '',
      warehouseId: '',
      locationId: '',
      uom: l.uom ?? '',
    }))
  );

  function updateLine(i: number, field: keyof DispatchLine, value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function applyDefaultWarehouse() {
    if (!defaultWarehouseId) return;
    setLines(prev => prev.map(l => ({ ...l, warehouseId: defaultWarehouseId })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dispatchDate) { setError('Dispatch date is required'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/purchase/returns/${praId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          praNo,
          dispatchDate,
          vehicleNo: vehicleNo || null,
          transportCompany: transportCompany || null,
          lines: lines.map(l => ({
            praLineId: l.praLineId,
            productId: l.productId,
            description: l.description,
            dispatchedQty: parseFloat(l.dispatchedQty) || 0,
            lotNo: l.lotNo || null,
            warehouseId: l.warehouseId || null,
            locationId: l.locationId || null,
            uom: l.uom || null,
          })),
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Dispatch failed'); }
      router.push(`/import/returns/${praId}`);
      router.refresh();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Dispatch Details</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Dispatch Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle No</Label>
            <Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="LHR-1234" />
          </div>
          <div className="space-y-1.5">
            <Label>Transport Company</Label>
            <Input value={transportCompany} onChange={e => setTransportCompany(e.target.value)} placeholder="TCS, Leopard..." />
          </div>
        </div>
        {/* Default warehouse applicator */}
        <div className="flex items-center gap-3 pt-1">
          <select value={defaultWarehouseId} onChange={e => setDefaultWarehouseId(e.target.value)}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Set dispatch warehouse for all lines…</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={applyDefaultWarehouse}>Apply to All</Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Items Being Dispatched Back</h2>
          <p className="text-xs text-slate-500 mt-0.5">Stock will be reduced for items with a warehouse selected</p>
        </div>
        <div className="space-y-3 p-5">
          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <p className="font-medium text-slate-800">{l.description}</p>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="space-y-1">
                  <Label className="text-xs">Authorized Qty</Label>
                  <div className="h-10 flex items-center px-3 rounded-md bg-slate-50 border border-slate-200 font-mono text-sm tabular-nums">
                    {l.returnQty} {l.uom}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-amber-700">Dispatched Qty <span className="text-red-500">*</span></Label>
                  <Input type="number" value={l.dispatchedQty} onChange={e => updateLine(i, 'dispatchedQty', e.target.value)}
                    min="0" step="0.001" className="border-amber-300 focus:ring-amber-500" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lot No</Label>
                  <Input value={l.lotNo} onChange={e => updateLine(i, 'lotNo', e.target.value)} placeholder="Lot #" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dispatch From Warehouse</Label>
                  <select value={l.warehouseId} onChange={e => updateLine(i, 'warehouseId', e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">No stock change</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 bg-amber-50 px-5 py-3 text-xs text-amber-700">
          Stock will be reduced by the dispatched quantity for all lines with a warehouse selected.
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving ? 'Dispatching…' : 'Confirm Dispatch'}
        </Button>
      </div>
    </form>
  );
}
