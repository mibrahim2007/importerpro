'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Link as LinkIcon } from 'lucide-react';

interface Shipment { id: string; shipmentNo: string; poId: string | null; lcId: string | null }
interface Gd { id: string; gdNo: string | null; shipmentId: string | null }
interface Lc { id: string; lcNo: string }
interface Grn { id: string; grnNo: string; shipmentId: string | null }

interface Props { shipments: Shipment[]; gds: Gd[]; lcs: Lc[]; grns: Grn[] }

export function CostSheetNewForm({ shipments, gds, lcs, grns }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [shipmentId, setShipmentId] = useState('');
  const [gdId, setGdId] = useState('');
  const [lcId, setLcId] = useState('');
  const [grnId, setGrnId] = useState('');

  const selectedShipment = useMemo(() => shipments.find((s) => s.id === shipmentId), [shipments, shipmentId]);

  const filteredGds = useMemo(() => {
    if (!shipmentId) return gds;
    return gds.filter((g) => !g.shipmentId || g.shipmentId === shipmentId);
  }, [gds, shipmentId]);

  const filteredGrns = useMemo(() => {
    if (!shipmentId) return grns;
    return grns.filter((g) => !g.shipmentId || g.shipmentId === shipmentId);
  }, [grns, shipmentId]);

  const handleShipmentChange = (id: string) => {
    setShipmentId(id);
    setGdId('');
    setGrnId('');
    const shipment = shipments.find((s) => s.id === id);
    if (shipment?.lcId) setLcId(shipment.lcId);
    else setLcId('');
  };

  const handleSubmit = async () => {
    if (!shipmentId) return toast.error('Select a shipment');
    setLoading(true);
    try {
      const res = await fetch('/api/cost-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId, gdId: gdId || null, lcId: lcId || null, grnId: grnId || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { sheet } = await res.json();
      toast.success(`Cost sheet ${sheet.costSheetNo} created`);
      router.push(`/import/cost-sheet/${sheet.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Link to Consignment Documents</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Select the shipment — GD, LC, and GRN will be used to auto-populate costs. All amounts can be edited on the next screen.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Shipment *</label>
            <select value={shipmentId} onChange={(e) => handleShipmentChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select shipment…</option>
              {shipments.map((s) => <option key={s.id} value={s.id}>{s.shipmentNo}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Goods Declaration (GD)</label>
            <select value={gdId} onChange={(e) => setGdId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None / manual entry</option>
              {filteredGds.map((g) => <option key={g.id} value={g.id}>{g.gdNo ?? 'GD (no no.)'}</option>)}
            </select>
            {gdId && <p className="text-xs text-teal-600 mt-1 flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Duty amounts will auto-fill from this GD</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Letter of Credit (LC)</label>
            <select value={lcId} onChange={(e) => setLcId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None / manual entry</option>
              {lcs.map((l) => <option key={l.id} value={l.id}>{l.lcNo}</option>)}
            </select>
            {lcId && <p className="text-xs text-teal-600 mt-1 flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Bank charges will auto-sum from LC charges log</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">GRN (for qty received)</label>
            <select value={grnId} onChange={(e) => setGrnId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None / enter qty manually</option>
              {filteredGrns.map((g) => <option key={g.id} value={g.id}>{g.grnNo}</option>)}
            </select>
            {grnId && <p className="text-xs text-teal-600 mt-1 flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Received qty will auto-fill for per-unit cost calc</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit} disabled={loading || !shipmentId}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Create & Edit Cost Sheet
        </Button>
      </div>
    </div>
  );
}
