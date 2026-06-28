'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface Product { id: string; code: string | null; name: string; hsCode: string | null; uom: string }
interface Warehouse { id: string; name: string }
interface StockLocation { id: string; warehouseId: string; name: string; locationType: string }
interface Shipment { id: string; shipmentNo: string }
interface GdRecord { id: string; gdNo: string | null }
interface Po { id: string; poNo: string; lines?: PoLine[] }
interface PoLine { productId: string; qty: string; uom: string | null }

interface Props {
  products: Product[];
  warehouses: Warehouse[];
  locations: StockLocation[];
  shipments: Shipment[];
  gds: GdRecord[];
  pos: Po[];
  initialShipmentId?: string;
  initialGdId?: string;
  initialPoId?: string;
}

interface GrnLine {
  productId: string;
  hsCode: string;
  orderedQty: string;
  receivedQty: string;
  uom: string;
  lotBatchNo: string;
  expiryDate: string;
  storageLocationId: string;
  qualityStatus: string;
  conditionOnReceipt: string;
  unitWeightKg: string;
  remarks: string;
}

const BLANK_LINE: GrnLine = {
  productId: '', hsCode: '', orderedQty: '', receivedQty: '',
  uom: 'KG', lotBatchNo: '', expiryDate: '', storageLocationId: '',
  qualityStatus: 'accepted', conditionOnReceipt: 'good', unitWeightKg: '', remarks: '',
};

const QC_COLORS: Record<string, string> = {
  accepted:  'bg-green-50 border-green-200',
  rejected:  'bg-red-50 border-red-200',
  under_qc:  'bg-amber-50 border-amber-200',
};

export function GrnForm({ products, warehouses, locations, shipments, gds, pos, initialShipmentId, initialGdId, initialPoId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<GrnLine[]>([]);

  const [form, setForm] = useState({
    grnDate: new Date().toISOString().split('T')[0],
    shipmentId: initialShipmentId ?? '',
    gdId: initialGdId ?? '',
    poId: initialPoId ?? '',
    warehouseId: '',
    receivingLocationId: '',
    vehicleNo: '',
    driverName: '',
    deliveryChallanNo: '',
    notes: '',
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i: number, k: keyof GrnLine, v: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const warehouseLocations = useMemo(
    () => locations.filter((l) => l.warehouseId === form.warehouseId),
    [locations, form.warehouseId]
  );

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const addLine = () => setLines((prev) => [...prev, { ...BLANK_LINE }]);

  // Pre-fill lines from PO when PO changes
  const handlePoChange = (poId: string) => {
    set('poId', poId);
    const po = pos.find((p) => p.id === poId);
    if (po?.lines && po.lines.length > 0) {
      setLines(po.lines.map((l) => ({
        ...BLANK_LINE,
        productId: l.productId,
        hsCode: productMap[l.productId]?.hsCode ?? '',
        orderedQty: l.qty,
        uom: l.uom ?? productMap[l.productId]?.uom ?? 'KG',
      })));
    }
  };

  const save = async () => {
    if (!form.warehouseId) { toast.error('Select a warehouse'); return; }
    if (lines.length === 0) { toast.error('Add at least one line item'); return; }
    if (lines.some((l) => !l.productId || !l.receivedQty)) {
      toast.error('All lines need a product and received qty'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          shipmentId: form.shipmentId || null,
          gdId: form.gdId || null,
          poId: form.poId || null,
          receivingLocationId: form.receivingLocationId || null,
          lines: lines.map((l) => ({
            ...l,
            orderedQty: l.orderedQty ? Number(l.orderedQty) : null,
            receivedQty: Number(l.receivedQty),
            unitWeightKg: l.unitWeightKg ? Number(l.unitWeightKg) : null,
            storageLocationId: l.storageLocationId || null,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { id } = await res.json();
      toast.success('GRN created');
      router.push(`/import/grn/${id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Receipt Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>GRN Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={form.grnDate} onChange={(e) => set('grnDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Challan No</Label>
            <Input placeholder="Supplier DC number" value={form.deliveryChallanNo}
              onChange={(e) => set('deliveryChallanNo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle No</Label>
            <Input placeholder="e.g. LEA-1234" value={form.vehicleNo}
              onChange={(e) => set('vehicleNo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Driver Name</Label>
            <Input value={form.driverName} onChange={(e) => set('driverName', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Links</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Purchase Order</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.poId} onChange={(e) => handlePoChange(e.target.value)}>
              <option value="">— None —</option>
              {pos.map((p) => <option key={p.id} value={p.id}>{p.poNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked Shipment</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.shipmentId} onChange={(e) => set('shipmentId', e.target.value)}>
              <option value="">— None —</option>
              {shipments.map((s) => <option key={s.id} value={s.id}>{s.shipmentNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked GD</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.gdId} onChange={(e) => set('gdId', e.target.value)}>
              <option value="">— None —</option>
              {gds.map((g) => <option key={g.id} value={g.id}>{g.gdNo ?? `GD (no no.)`}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Warehouse */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Receiving Location</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Warehouse <span className="text-red-500">*</span></Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.warehouseId} onChange={(e) => { set('warehouseId', e.target.value); set('receivingLocationId', ''); }}>
              <option value="">— Select warehouse —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Receiving Bay / Location</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.receivingLocationId} onChange={(e) => set('receivingLocationId', e.target.value)}
              disabled={!form.warehouseId}>
              <option value="">— Select location —</option>
              {warehouseLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Line Items ({lines.length})</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              {form.poId ? 'No lines loaded from PO — add manually.' : 'Add line items or link a PO to pre-fill.'}
            </p>
          )}
          {lines.map((l, i) => {
            const prod = productMap[l.productId];
            const shortExcess = l.orderedQty && l.receivedQty
              ? Number(l.receivedQty) - Number(l.orderedQty) : null;
            return (
              <div key={i} className={`border rounded-lg p-4 space-y-3 ${QC_COLORS[l.qualityStatus]}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product <span className="text-red-500">*</span></Label>
                      <select className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
                        value={l.productId}
                        onChange={(e) => {
                          const p = productMap[e.target.value];
                          setLine(i, 'productId', e.target.value);
                          if (p) { setLine(i, 'hsCode', p.hsCode ?? ''); setLine(i, 'uom', p.uom); }
                        }}>
                        <option value="">— Select product —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">HS Code</Label>
                      <Input className="text-xs font-mono" value={l.hsCode}
                        onChange={(e) => setLine(i, 'hsCode', e.target.value)} />
                    </div>
                  </div>
                  <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 mt-3">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ordered Qty</Label>
                    <Input type="number" className="text-xs" value={l.orderedQty}
                      onChange={(e) => setLine(i, 'orderedQty', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Received Qty <span className="text-red-500">*</span></Label>
                    <Input type="number" className="text-xs" value={l.receivedQty}
                      onChange={(e) => setLine(i, 'receivedQty', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">UOM</Label>
                    <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                      value={l.uom} onChange={(e) => setLine(i, 'uom', e.target.value)}>
                      {['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders'].map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit Weight (KG)</Label>
                    <Input type="number" step="0.0001" className="text-xs" value={l.unitWeightKg}
                      onChange={(e) => setLine(i, 'unitWeightKg', e.target.value)} />
                  </div>
                </div>

                {/* Short/excess indicator */}
                {shortExcess !== null && shortExcess !== 0 && (
                  <div className={`flex items-center gap-2 text-xs font-medium ${shortExcess < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {shortExcess < 0 ? `Short: ${Math.abs(shortExcess)} ${l.uom}` : `Excess: ${shortExcess} ${l.uom}`}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lot / Batch No</Label>
                    <Input className="text-xs" value={l.lotBatchNo}
                      onChange={(e) => setLine(i, 'lotBatchNo', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Expiry Date</Label>
                    <Input type="date" className="text-xs" value={l.expiryDate}
                      onChange={(e) => setLine(i, 'expiryDate', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Storage Location</Label>
                    <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                      value={l.storageLocationId}
                      onChange={(e) => setLine(i, 'storageLocationId', e.target.value)}>
                      <option value="">— Default —</option>
                      {warehouseLocations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quality Status</Label>
                    <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                      value={l.qualityStatus} onChange={(e) => setLine(i, 'qualityStatus', e.target.value)}>
                      <option value="accepted">Accepted</option>
                      <option value="under_qc">Under QC</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Condition on Receipt</Label>
                    <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                      value={l.conditionOnReceipt} onChange={(e) => setLine(i, 'conditionOnReceipt', e.target.value)}>
                      {['good', 'damaged', 'wet', 'short'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Remarks</Label>
                    <Input className="text-xs" value={l.remarks}
                      onChange={(e) => setLine(i, 'remarks', e.target.value)} />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4 space-y-1.5">
          <Label>Notes / Remarks</Label>
          <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Create GRN
        </Button>
      </div>
    </div>
  );
}
