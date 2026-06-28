'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Product { id: string; code: string | null; name: string; uom: string }
interface Warehouse { id: string; name: string }
interface Location { id: string; warehouseId: string; name: string }

interface Props {
  products: Product[];
  warehouses: Warehouse[];
  locations: Location[];
}

interface Line { productId: string; lotBatchNo: string; requestedQty: string; uom: string }

export function TransferForm({ products, warehouses, locations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', lotBatchNo: '', requestedQty: '', uom: '' }]);

  const fromLocations = useMemo(() => locations.filter((l) => l.warehouseId === fromWarehouseId), [locations, fromWarehouseId]);
  const toLocations = useMemo(() => locations.filter((l) => l.warehouseId === toWarehouseId), [locations, toWarehouseId]);

  const updateLine = (i: number, field: keyof Line, value: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const addLine = () => setLines((prev) => [...prev, { productId: '', lotBatchNo: '', requestedQty: '', uom: '' }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const handleProductChange = (i: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, productId, uom: prod?.uom ?? '' } : l));
  };

  const handleSubmit = async () => {
    if (!fromWarehouseId || !toWarehouseId) return toast.error('Select source and destination warehouses');
    if (fromWarehouseId === toWarehouseId && fromLocationId === toLocationId) return toast.error('Source and destination must differ');
    const validLines = lines.filter((l) => l.productId && parseFloat(l.requestedQty) > 0);
    if (!validLines.length) return toast.error('Add at least one line with a product and quantity');

    setLoading(true);
    try {
      const res = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferDate, fromWarehouseId, fromLocationId: fromLocationId || null, toWarehouseId, toLocationId: toLocationId || null, reason, notes, lines: validLines }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create');
      const { transfer } = await res.json();
      toast.success(`Transfer ${transfer.transferNo} created`);
      router.push(`/warehouse/transfers/${transfer.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Route card */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Transfer Route</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Warehouse *</label>
              <select value={fromWarehouseId} onChange={(e) => { setFromWarehouseId(e.target.value); setFromLocationId(''); }} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {fromLocations.length > 0 && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Location</label>
                <select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">All locations</option>
                  {fromLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Warehouse *</label>
              <select value={toWarehouseId} onChange={(e) => { setToWarehouseId(e.target.value); setToLocationId(''); }} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {toLocations.length > 0 && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Location</label>
                <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Any location</option>
                  {toLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Transfer Date *</label>
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Consolidation, Production issue…" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Lines card */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Items to Transfer</CardTitle>
          <Button variant="ghost" size="sm" onClick={addLine} className="text-teal-600"><Plus className="h-3.5 w-3.5 mr-1" /> Add Line</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
              <div className="col-span-5">
                <label className="block text-xs text-slate-400 mb-1">Product</label>
                <select value={l.productId} onChange={(e) => handleProductChange(i, e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                  <option value="">Select product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Lot / Batch</label>
                <input value={l.lotBatchNo} onChange={(e) => updateLine(i, 'lotBatchNo', e.target.value)} placeholder="Optional" className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Qty *</label>
                <input type="number" min="0" step="0.001" value={l.requestedQty} onChange={(e) => updateLine(i, 'requestedQty', e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">UOM</label>
                <input value={l.uom} onChange={(e) => updateLine(i, 'uom', e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white" />
              </div>
              <div className="col-span-1 flex justify-end">
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Create Transfer
        </Button>
      </div>
    </div>
  );
}
