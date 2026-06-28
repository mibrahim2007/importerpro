'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, X, Check } from 'lucide-react';

interface Supplier { id: string; name: string; code?: string | null }
interface Po { id: string; poNo: string; supplierId: string; cifValueUsd?: string | null; currency?: string | null; portOfDischarge?: string | null; portOfLoading?: string | null; incoterms?: string | null; latestShipDate?: string | null; lcExpiryDate?: string | null; bankIssuingLc?: string | null }

const LC_TYPES = [
  { value: 'sight', label: 'Sight LC' },
  { value: 'usance_30', label: 'Usance 30 days' },
  { value: 'usance_60', label: 'Usance 60 days' },
  { value: 'usance_90', label: 'Usance 90 days' },
  { value: 'usance_120', label: 'Usance 120 days' },
  { value: 'usance_180', label: 'Usance 180 days' },
];

const INCOTERMS = ['CIF', 'FOB', 'CFR', 'EXW', 'DDP'];
const CURRENCIES = ['USD', 'EUR', 'CNY', 'AED', 'GBP', 'PKR'];

const ALL_DOCS = [
  { value: 'commercial_invoice', label: 'Commercial Invoice' },
  { value: 'packing_list', label: 'Packing List' },
  { value: 'bill_of_lading', label: 'Bill of Lading' },
  { value: 'certificate_of_origin', label: 'Certificate of Origin' },
  { value: 'bill_of_exchange', label: 'Bill of Exchange' },
  { value: 'phytosanitary_certificate', label: 'Phytosanitary Certificate' },
  { value: 'fumigation_certificate', label: 'Fumigation Certificate' },
  { value: 'weight_certificate', label: 'Weight Certificate' },
  { value: 'inspection_certificate', label: 'Inspection / SGS Certificate' },
  { value: 'form_e', label: 'Form-E (SBP)' },
];

const DEFAULT_DOCS = ['commercial_invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin', 'bill_of_exchange'];

export function LcForm({ suppliers, openPos, initialPoId }: { suppliers: Supplier[]; openPos: Po[]; initialPoId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(DEFAULT_DOCS);

  const initialPo = openPos.find((p) => p.id === initialPoId);

  const [form, setForm] = useState({
    lcNo: '',
    poId: initialPoId ?? '',
    supplierId: initialPo?.supplierId ?? '',
    lcType: 'sight',
    lcAmount: initialPo?.cifValueUsd ? String(Number(initialPo.cifValueUsd).toFixed(2)) : '',
    currency: initialPo?.currency ?? 'USD',
    issuingBank: initialPo?.bankIssuingLc ?? '',
    advisingBank: '',
    openingDate: '',
    expiryDate: initialPo?.lcExpiryDate ?? '',
    latestShipDate: initialPo?.latestShipDate ?? '',
    presentationDays: '21',
    portOfLoading: initialPo?.portOfLoading ?? '',
    portOfDischarge: initialPo?.portOfDischarge ?? '',
    incoterms: initialPo?.incoterms ?? 'CIF',
    partialShipment: false,
    transhipment: false,
    specialTerms: '',
  });

  const h = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleDoc = (d: string) =>
    setSelectedDocs((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  // Auto-fill from PO
  const handlePoChange = (poId: string) => {
    const po = openPos.find((p) => p.id === poId);
    if (po) {
      setForm((f) => ({
        ...f,
        poId,
        supplierId: po.supplierId,
        lcAmount: po.cifValueUsd ? String(Number(po.cifValueUsd).toFixed(2)) : f.lcAmount,
        currency: po.currency ?? f.currency,
        issuingBank: po.bankIssuingLc ?? f.issuingBank,
        expiryDate: po.lcExpiryDate ?? f.expiryDate,
        latestShipDate: po.latestShipDate ?? f.latestShipDate,
        portOfLoading: po.portOfLoading ?? f.portOfLoading,
        portOfDischarge: po.portOfDischarge ?? f.portOfDischarge,
        incoterms: po.incoterms ?? f.incoterms,
      }));
    } else {
      setForm((f) => ({ ...f, poId }));
    }
  };

  const submit = async () => {
    if (!form.lcNo) { toast.error('LC number required'); return; }
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (!form.lcAmount || Number(form.lcAmount) <= 0) { toast.error('LC amount required'); return; }
    if (!form.issuingBank) { toast.error('Issuing bank required'); return; }
    if (!form.expiryDate) { toast.error('Expiry date required'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/lc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lcAmount: Number(form.lcAmount),
          presentationDays: Number(form.presentationDays),
          poId: form.poId || undefined,
          advisingBank: form.advisingBank || undefined,
          openingDate: form.openingDate || undefined,
          latestShipDate: form.latestShipDate || undefined,
          portOfLoading: form.portOfLoading || undefined,
          portOfDischarge: form.portOfDischarge || undefined,
          specialTerms: form.specialTerms || undefined,
          requiredDocuments: selectedDocs,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const lc = await res.json();
      toast.success('LC created');
      router.push(`/import/lc/${lc.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      {/* LC Identity */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">LC Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">LC Number (Bank Reference) <span className="text-red-500">*</span></Label>
            <Input placeholder="HBL-2024-001234" value={form.lcNo} onChange={h('lcNo')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">LC Type</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={form.lcType} onChange={h('lcType')}>
              {LC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Linked PO</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={form.poId} onChange={(e) => handlePoChange(e.target.value)}>
              <option value="">— Standalone LC —</option>
              {openPos.map((p) => <option key={p.id} value={p.id}>{p.poNo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Beneficiary (Supplier) <span className="text-red-500">*</span></Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={form.supplierId} onChange={h('supplierId')}>
              <option value="">— Select Supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">LC Amount <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <select className="w-24 border rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
                value={form.currency} onChange={h('currency')}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <Input type="number" step="0.01" className="flex-1" placeholder="0.00"
                value={form.lcAmount} onChange={h('lcAmount')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Incoterms</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              value={form.incoterms} onChange={h('incoterms')}>
              {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Banks & Dates */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Banks &amp; Dates</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Issuing Bank (Pakistan) <span className="text-red-500">*</span></Label>
            <Input placeholder="Habib Bank Limited — Trade Finance, Karachi"
              value={form.issuingBank} onChange={h('issuingBank')} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Advising Bank (Supplier's Country)</Label>
            <Input placeholder="Bank of China — Shanghai Branch"
              value={form.advisingBank} onChange={h('advisingBank')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Opening Date</Label>
            <Input type="date" value={form.openingDate} onChange={h('openingDate')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expiry Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={form.expiryDate} onChange={h('expiryDate')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Latest Shipment Date</Label>
            <Input type="date" value={form.latestShipDate} onChange={h('latestShipDate')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Presentation Period (days after BL)</Label>
            <Input type="number" min="1" max="45" value={form.presentationDays} onChange={h('presentationDays')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port of Loading</Label>
            <Input placeholder="Shanghai" value={form.portOfLoading} onChange={h('portOfLoading')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port of Discharge</Label>
            <Input placeholder="Karachi / Port Qasim" value={form.portOfDischarge} onChange={h('portOfDischarge')} />
          </div>
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.partialShipment}
                onChange={(e) => setForm((f) => ({ ...f, partialShipment: e.target.checked }))}
                className="rounded" />
              Partial Shipment Allowed
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.transhipment}
                onChange={(e) => setForm((f) => ({ ...f, transhipment: e.target.checked }))}
                className="rounded" />
              Transhipment Allowed
            </label>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Special Terms / Conditions</Label>
            <Input placeholder="e.g. All documents in English, Original + 3 copies required…"
              value={form.specialTerms} onChange={h('specialTerms')} />
          </div>
        </CardContent>
      </Card>

      {/* Document Checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Required Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {ALL_DOCS.map((doc) => (
              <label key={doc.value} className="flex items-center gap-2.5 text-sm cursor-pointer p-2 rounded hover:bg-slate-50">
                <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                  selectedDocs.includes(doc.value) ? 'bg-teal-600 border-teal-600' : 'border-slate-300'
                }`} onClick={() => toggleDoc(doc.value)}>
                  {selectedDocs.includes(doc.value) && <Check className="h-3 w-3 text-white" />}
                </div>
                {doc.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} disabled={loading}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Create LC
        </Button>
      </div>
    </div>
  );
}
