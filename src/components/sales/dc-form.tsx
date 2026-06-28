'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Package, ChevronDown, ChevronRight } from 'lucide-react';

interface Lot { lotBatchNo: string | null; expiryDate: string | null; reservedQty: number; releasedQty: number }
interface SoLine {
  id: string; productId: string; productName: string | null; productCode: string | null;
  orderedQty: string | null; uom: string | null; remainingReserved: number; lots: Lot[];
}
interface SoOption {
  id: string; soNo: string; soDate: string; status: string | null;
  customerName: string | null; customerId: string; warehouseId: string | null; lines: SoLine[];
}

interface DcLine {
  soLineId: string; productId: string; productName: string; productCode: string;
  lotBatchNo: string; expiryDate: string; uom: string;
  dispatchedQty: string; grossWeightKg: string; netWeightKg: string;
  packageCount: string; packageType: string; weighmentSlipNo: string; qualityCertNo: string;
}

const TODAY = new Date().toISOString().split('T')[0];
const PKG_TYPES = ['bags', 'drums', 'cylinders', 'cartons', 'bulk'];

export function DcForm({ prefillSoId }: { prefillSoId?: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<SoOption[]>([]);
  const [selectedSoId, setSelectedSoId] = useState(prefillSoId ?? '');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dcLines, setDcLines] = useState<DcLine[]>([]);
  const [form, setForm] = useState({
    dcDate: TODAY, vehicleNo: '', driverName: '', driverCnic: '',
    transportCompany: '', freightResponsibility: 'ex_works', freightChargesPkr: '',
    estimatedArrivalDate: '', notes: '',
  });

  useEffect(() => {
    fetch('/api/sales/orders/confirmed').then((r) => r.json()).then(setOrders).catch(() => {});
  }, []);

  const selectedSo = orders.find((o) => o.id === selectedSoId);

  useEffect(() => {
    if (!selectedSo) { setDcLines([]); return; }
    // Auto-build DC lines from reserved lots (one line per lot per SO line)
    const lines: DcLine[] = [];
    for (const soLine of selectedSo.lines) {
      for (const lot of soLine.lots) {
        const remaining = lot.reservedQty - lot.releasedQty;
        if (remaining <= 0) continue;
        lines.push({
          soLineId: soLine.id, productId: soLine.productId,
          productName: soLine.productName ?? '', productCode: soLine.productCode ?? '',
          lotBatchNo: lot.lotBatchNo ?? '', expiryDate: lot.expiryDate ?? '',
          uom: soLine.uom ?? '',
          dispatchedQty: String(remaining),
          grossWeightKg: '', netWeightKg: '', packageCount: '', packageType: 'bags',
          weighmentSlipNo: '', qualityCertNo: '',
        });
      }
    }
    setDcLines(lines);
  }, [selectedSoId, orders]);

  const setLine = (i: number, k: string, v: string) =>
    setDcLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const totalDispatchedQty = dcLines.reduce((s, l) => s + parseFloat(l.dispatchedQty || '0'), 0);
  const totalNetWeight = dcLines.reduce((s, l) => s + parseFloat(l.netWeightKg || '0'), 0);

  const handleSave = async () => {
    if (!selectedSoId) return toast.error('Select a sales order');
    if (!dcLines.length) return toast.error('No dispatch lines');
    setSaving(true);
    try {
      const res = await fetch('/api/sales/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, soId: selectedSoId, customerId: selectedSo?.customerId,
          warehouseId: selectedSo?.warehouseId,
          lines: dcLines.filter((l) => parseFloat(l.dispatchedQty || '0') > 0),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(`Dispatch Challan ${data.dcNo} created`);
      router.push(`/sales/dispatch/${data.id}`);
    } catch { toast.error('Failed to create dispatch challan'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Dispatch Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Sales Order *</label>
            <select value={selectedSoId} onChange={(e) => setSelectedSoId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select confirmed SO…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.soNo} — {o.customerName} ({o.status})</option>
              ))}
            </select>
            {selectedSo && <p className="mt-1 text-xs text-slate-400">Customer: {selectedSo.customerName} · {selectedSo.lines.length} product(s) to dispatch</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">DC Date *</label>
            <input type="date" value={form.dcDate} onChange={(e) => setF('dcDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Vehicle / Truck No</label>
            <input value={form.vehicleNo} onChange={(e) => setF('vehicleNo', e.target.value)} placeholder="e.g. LEJ-1234" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Driver Name</label>
            <input value={form.driverName} onChange={(e) => setF('driverName', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Driver CNIC</label>
            <input value={form.driverCnic} onChange={(e) => setF('driverCnic', e.target.value)} placeholder="XXXXX-XXXXXXX-X" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Transport Company</label>
            <input value={form.transportCompany} onChange={(e) => setF('transportCompany', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Freight Responsibility</label>
            <select value={form.freightResponsibility} onChange={(e) => setF('freightResponsibility', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="ex_works">Ex-Works (customer collects)</option>
              <option value="to_door">To-Door (freight included)</option>
            </select>
          </div>
          {form.freightResponsibility === 'to_door' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Freight Charges (PKR)</label>
              <input type="number" value={form.freightChargesPkr} onChange={(e) => setF('freightChargesPkr', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Est. Arrival at Customer</label>
            <input type="date" value={form.estimatedArrivalDate} onChange={(e) => setF('estimatedArrivalDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setF('notes', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {dcLines.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Dispatch Lines ({dcLines.length} lot{dcLines.length !== 1 ? 's' : ''})</CardTitle>
            <div className="text-xs text-slate-400">
              Total: {totalDispatchedQty.toLocaleString('en-PK', { maximumFractionDigits: 1 })} units · {totalNetWeight.toFixed(1)} kg net
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['Product', 'Lot No', 'Expiry', 'Qty to Dispatch', 'UOM', 'Gross Wt (kg)', 'Net Wt (kg)', 'Pkgs', 'Pkg Type', 'Weighment Slip', 'QC Cert'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dcLines.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-700 text-xs">{l.productName}</p>
                        {l.productCode && <p className="text-[10px] text-slate-400">{l.productCode}</p>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{l.lotBatchNo || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{l.expiryDate || '—'}</td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.dispatchedQty} onChange={(e) => setLine(i, 'dispatchedQty', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-20 text-right font-semibold" />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{l.uom}</td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.grossWeightKg} onChange={(e) => setLine(i, 'grossWeightKg', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-24" placeholder="0.000" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.netWeightKg} onChange={(e) => setLine(i, 'netWeightKg', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-24" placeholder="0.000" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={l.packageCount} onChange={(e) => setLine(i, 'packageCount', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-16" placeholder="0" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={l.packageType} onChange={(e) => setLine(i, 'packageType', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs capitalize">
                          {PKG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.weighmentSlipNo} onChange={(e) => setLine(i, 'weighmentSlipNo', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-28" placeholder="WS-xxxx" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.qualityCertNo} onChange={(e) => setLine(i, 'qualityCertNo', e.target.value)}
                          className="border rounded px-2 py-1.5 text-xs w-28" placeholder="Optional" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSoId && dcLines.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm border rounded-xl bg-white">
          No pending reserved stock found for this order.
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving || !dcLines.length}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Save Dispatch Challan
        </Button>
      </div>
    </div>
  );
}
