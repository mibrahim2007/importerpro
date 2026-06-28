'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { GdDutyCalculator, type GdLine } from './gd-duty-calculator';

interface Shipment { id: string; shipmentNo: string; blNo: string | null; portOfDischarge: string | null }

interface Props {
  shipments: Shipment[];
  initialShipmentId?: string;
  companyNtn?: string;
  companyStrn?: string;
}

const GD_TYPES = [
  { value: 'home_consumption', label: 'Home Consumption (HC)' },
  { value: 'warehousing', label: 'Warehousing (WH)' },
  { value: 'transit', label: 'Transit' },
];

const CUSTOMS_STATIONS = [
  'KAPE - Karachi Port East', 'KAQE - Karachi Qasim East', 'KHI-Airport', 'Lahore Dry Port',
  'IIIP - Islamabad Dry Port', 'Faisalabad Dry Port', 'SAPT - South Asia Port Terminal',
];

export function GdForm({ shipments, initialShipmentId, companyNtn, companyStrn }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<GdLine[]>([]);

  const [form, setForm] = useState({
    gdNo: '',
    gdDate: '',
    gdType: 'home_consumption',
    shipmentId: initialShipmentId ?? '',
    clearingAgentName: '',
    customsStation: '',
    importRegNo: '',
    ntn: companyNtn ?? '',
    strn: companyStrn ?? '',
    exchangeRate: '',
    srosApplied: '',
    notes: '',
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (lines.length === 0) { toast.error('Add at least one GD line item'); return; }
    if (lines.some((l) => !l.hsCode || !l.commodityDescription)) {
      toast.error('All lines need HS code and commodity description'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/customs/gd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          shipmentId: form.shipmentId || null,
          exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
          lines: lines.map((l) => ({
            ...l,
            qty: l.qty ? Number(l.qty) : null,
            cifValuePkr: l.cifValuePkr ? Number(l.cifValuePkr) : null,
            assessableValuePkr: l.assessableValuePkr ? Number(l.assessableValuePkr) : (l.cifValuePkr ? Number(l.cifValuePkr) : null),
            customsDutyPct: l.customsDutyPct ? Number(l.customsDutyPct) : null,
            additionalCdPct: l.additionalCdPct ? Number(l.additionalCdPct) : null,
            regulatoryDutyPct: l.regulatoryDutyPct ? Number(l.regulatoryDutyPct) : null,
            salesTaxPct: Number(l.salesTaxPct || 17),
            whtPct: l.whtPct ? Number(l.whtPct) : null,
            incomeTaxPct: l.incomeTaxPct ? Number(l.incomeTaxPct) : null,
            antiDumpingDutyPkr: l.antiDumpingDutyPkr ? Number(l.antiDumpingDutyPkr) : null,
            sroDeductionPkr: l.sroDeductionPkr ? Number(l.sroDeductionPkr) : null,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { id } = await res.json();
      toast.success('GD created');
      router.push(`/import/customs/${id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* GD Identity */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">GD Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>GD No (WeBOC reference)</Label>
            <Input placeholder="e.g. KAPE-HC-2026-0012345 (leave blank if not filed yet)"
              value={form.gdNo} onChange={(e) => set('gdNo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>GD Date</Label>
            <Input type="date" value={form.gdDate} onChange={(e) => set('gdDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>GD Type</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.gdType} onChange={(e) => set('gdType', e.target.value)}>
              {GD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked Shipment</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.shipmentId} onChange={(e) => set('shipmentId', e.target.value)}>
              <option value="">— None —</option>
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shipmentNo} {s.blNo ? `/ ${s.blNo}` : ''} {s.portOfDischarge ? `→ ${s.portOfDischarge}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Customs Station</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={form.customsStation} onChange={(e) => set('customsStation', e.target.value)}>
              <option value="">— Select —</option>
              {CUSTOMS_STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Clearing Agent</Label>
            <Input placeholder="Agent name" value={form.clearingAgentName}
              onChange={(e) => set('clearingAgentName', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Consignee / Legal */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Consignee & Exchange Rate</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>NTN (National Tax Number)</Label>
            <Input placeholder="0000000-0" value={form.ntn} onChange={(e) => set('ntn', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>STRN (Sales Tax Reg. No)</Label>
            <Input placeholder="00-00-0000-000-00" value={form.strn} onChange={(e) => set('strn', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Import Reg. No</Label>
            <Input placeholder="Importer's registration" value={form.importRegNo}
              onChange={(e) => set('importRegNo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Exchange Rate (USD → PKR)</Label>
            <Input type="number" step="0.0001" placeholder="e.g. 278.50" value={form.exchangeRate}
              onChange={(e) => set('exchangeRate', e.target.value)} />
            <p className="text-xs text-slate-400">SBP rate at time of filing</p>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>SROs Applied (comma-separated)</Label>
            <Input placeholder="e.g. SRO 678(I)/2024, SRO 1125(I)/2021"
              value={form.srosApplied} onChange={(e) => set('srosApplied', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Duty Calculator */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">GD Line Items & Duty Calculator</CardTitle></CardHeader>
        <CardContent>
          <GdDutyCalculator lines={lines} onChange={setLines} exchangeRate={form.exchangeRate} />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4 space-y-1.5">
          <Label>Notes / Remarks</Label>
          <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Any special notes on this GD…" value={form.notes}
            onChange={(e) => set('notes', e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={save} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Create GD
        </Button>
      </div>
    </div>
  );
}
