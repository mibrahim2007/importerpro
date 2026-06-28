'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface Po { id: string; poNo: string; supplierId: string }
interface Lc { id: string; lcNo: string; poId: string | null }
interface Supplier { id: string; name: string }

interface Props {
  openPos: Po[];
  openLcs: Lc[];
  suppliers: Supplier[];
  initialPoId?: string;
  initialLcId?: string;
}

const MODES = ['sea', 'air', 'road'] as const;
const BL_TYPES = [{ value: 'original', label: 'Original B/L' }, { value: 'telex', label: 'Telex Release' }, { value: 'seawaybill', label: 'Sea Waybill' }];
const CONTAINER_TYPES = ['20GP', '40GP', '40HC', 'LCL', 'Break Bulk'];

export function ShipmentForm({ openPos, openLcs, suppliers, initialPoId, initialLcId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    poId: initialPoId ?? '',
    lcId: initialLcId ?? '',
    mode: 'sea',
    vesselName: '',
    voyageNo: '',
    shippingLineName: '',
    freightForwarderName: '',
    blNo: '',
    blDate: '',
    blType: 'original',
    portOfLoading: '',
    portOfDischarge: '',
    etd: '',
    atd: '',
    eta: '',
    freightAmount: '',
    freightCurrency: 'USD',
    freightPayment: 'prepaid',
    freightInvoiceNo: '',
    packageCount: '',
    grossWeightKg: '',
    netWeightKg: '',
    volumeCbm: '',
    notes: '',
  });

  const [containers, setContainers] = useState<{
    containerNo: string; sealNo: string; containerType: string;
    portFreeDays: string; detentionFreeDays: string; demurrageRatePerDay: string; demurrageCurrency: string;
  }[]>([]);

  const addContainer = () => setContainers((prev) => [...prev, {
    containerNo: '', sealNo: '', containerType: '20GP',
    portFreeDays: '7', detentionFreeDays: '7', demurrageRatePerDay: '', demurrageCurrency: 'USD',
  }]);

  const updateContainer = (i: number, k: string, v: string) =>
    setContainers((prev) => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c));

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.blNo && form.mode === 'sea') { toast.error('B/L number is required for sea shipments'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          poId: form.poId || null,
          lcId: form.lcId || null,
          freightAmount: form.freightAmount ? Number(form.freightAmount) : null,
          packageCount: form.packageCount ? Number(form.packageCount) : null,
          grossWeightKg: form.grossWeightKg ? Number(form.grossWeightKg) : null,
          netWeightKg: form.netWeightKg ? Number(form.netWeightKg) : null,
          volumeCbm: form.volumeCbm ? Number(form.volumeCbm) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { id } = await res.json();

      // Save containers
      for (const c of containers) {
        if (!c.containerNo.trim()) continue;
        await fetch(`/api/shipments/${id}/containers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...c,
            portFreeDays: Number(c.portFreeDays) || 7,
            detentionFreeDays: Number(c.detentionFreeDays) || 7,
            demurrageRatePerDay: c.demurrageRatePerDay ? Number(c.demurrageRatePerDay) : null,
          }),
        });
      }

      toast.success('Shipment created');
      router.push(`/import/shipments/${id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Links */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Link to PO / LC</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Purchase Order</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.poId} onChange={(e) => set('poId', e.target.value)}>
              <option value="">— None —</option>
              {openPos.map((p) => <option key={p.id} value={p.id}>{p.poNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Letter of Credit</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.lcId} onChange={(e) => set('lcId', e.target.value)}>
              <option value="">— None —</option>
              {openLcs.map((l) => <option key={l.id} value={l.id}>{l.lcNo}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Vessel & B/L */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Vessel & Bill of Lading</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Mode of Transport</Label>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button key={m} type="button"
                  onClick={() => set('mode', m)}
                  className={`flex-1 py-2 text-sm rounded-md border capitalize transition-colors ${form.mode === m ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Shipping Line</Label>
            <Input placeholder="e.g. COSCO, Evergreen, MSC" value={form.shippingLineName} onChange={(e) => set('shippingLineName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vessel Name</Label>
            <Input placeholder="e.g. COSCO SHIPPING ROSE" value={form.vesselName} onChange={(e) => set('vesselName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Voyage No</Label>
            <Input placeholder="e.g. 221E" value={form.voyageNo} onChange={(e) => set('voyageNo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>B/L No <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. COSB1234567890" value={form.blNo} onChange={(e) => set('blNo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>B/L Date</Label>
            <Input type="date" value={form.blDate} onChange={(e) => set('blDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>B/L Type</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.blType} onChange={(e) => set('blType', e.target.value)}>
              {BL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Freight Forwarder</Label>
            <Input placeholder="e.g. Maersk Logistics" value={form.freightForwarderName} onChange={(e) => set('freightForwarderName', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Ports & Dates */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ports & Dates</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Port of Loading</Label>
            <Input placeholder="e.g. Shanghai" value={form.portOfLoading} onChange={(e) => set('portOfLoading', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Port of Discharge</Label>
            <Input placeholder="e.g. Karachi (KPKT)" value={form.portOfDischarge} onChange={(e) => set('portOfDischarge', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ETD (Est. Departure)</Label>
            <Input type="date" value={form.etd} onChange={(e) => set('etd', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ATD (Actual Departure)</Label>
            <Input type="date" value={form.atd} onChange={(e) => set('atd', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ETA (Est. Arrival)</Label>
            <Input type="date" value={form.eta} onChange={(e) => set('eta', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Cargo */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cargo Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Package Count</Label>
            <Input type="number" placeholder="0" value={form.packageCount} onChange={(e) => set('packageCount', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gross Weight (KG)</Label>
            <Input type="number" step="0.001" placeholder="0.000" value={form.grossWeightKg} onChange={(e) => set('grossWeightKg', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Net Weight (KG)</Label>
            <Input type="number" step="0.001" placeholder="0.000" value={form.netWeightKg} onChange={(e) => set('netWeightKg', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Volume (CBM)</Label>
            <Input type="number" step="0.001" placeholder="0.000" value={form.volumeCbm} onChange={(e) => set('volumeCbm', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Freight */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Freight Charges</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Freight Amount</Label>
            <div className="flex gap-2">
              <select className="w-20 border rounded-md px-2 py-2 text-sm bg-white" value={form.freightCurrency}
                onChange={(e) => set('freightCurrency', e.target.value)}>
                <option>USD</option><option>EUR</option><option>PKR</option>
              </select>
              <Input type="number" step="0.01" className="flex-1" placeholder="0.00" value={form.freightAmount}
                onChange={(e) => set('freightAmount', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Freight Payment</Label>
            <div className="flex gap-2">
              {['prepaid', 'collect'].map((p) => (
                <button key={p} type="button" onClick={() => set('freightPayment', p)}
                  className={`flex-1 py-2 text-sm rounded-md border capitalize transition-colors ${form.freightPayment === p ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Freight Invoice No</Label>
            <Input placeholder="Forwarder's invoice no" value={form.freightInvoiceNo} onChange={(e) => set('freightInvoiceNo', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Containers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Containers ({containers.length})</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addContainer}>+ Add Container</Button>
          </div>
        </CardHeader>
        {containers.length > 0 && (
          <CardContent className="space-y-4">
            {containers.map((c, i) => (
              <div key={i} className="p-4 border rounded-lg bg-slate-50 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Container No <span className="text-red-500">*</span></Label>
                  <Input className="font-mono text-xs" placeholder="ABCU1234567" value={c.containerNo}
                    onChange={(e) => updateContainer(i, 'containerNo', e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Seal No</Label>
                  <Input className="text-xs" value={c.sealNo} onChange={(e) => updateContainer(i, 'sealNo', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-white" value={c.containerType}
                    onChange={(e) => updateContainer(i, 'containerType', e.target.value)}>
                    {CONTAINER_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Port Free Days</Label>
                  <Input type="number" className="text-xs" value={c.portFreeDays}
                    onChange={(e) => updateContainer(i, 'portFreeDays', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Demurrage Rate / Day</Label>
                  <div className="flex gap-1">
                    <select className="w-16 border rounded-md px-1 py-1.5 text-xs bg-white" value={c.demurrageCurrency}
                      onChange={(e) => updateContainer(i, 'demurrageCurrency', e.target.value)}>
                      <option>USD</option><option>PKR</option>
                    </select>
                    <Input type="number" step="0.01" className="flex-1 text-xs" placeholder="0" value={c.demurrageRatePerDay}
                      onChange={(e) => updateContainer(i, 'demurrageRatePerDay', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Detention Free Days</Label>
                  <Input type="number" className="text-xs" value={c.detentionFreeDays}
                    onChange={(e) => updateContainer(i, 'detentionFreeDays', e.target.value)} />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" className="text-red-400 text-xs"
                    onClick={() => setContainers((prev) => prev.filter((_, idx) => idx !== i))}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4 space-y-1.5">
          <Label>Notes / Remarks</Label>
          <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Any special handling notes…" value={form.notes}
            onChange={(e) => set('notes', e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Create Shipment
        </Button>
      </div>
    </div>
  );
}
