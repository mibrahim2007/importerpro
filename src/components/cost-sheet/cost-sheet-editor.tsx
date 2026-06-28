'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, Unlock, CheckCircle2 } from 'lucide-react';

interface Sheet {
  id: string; status: string; costSheetNo: string;
  fobValueUsd: string | null; freightUsd: string | null; insuranceUsd: string | null;
  cifValueUsd: string | null; exchangeRateApplied: string | null; cifValuePkr: string | null;
  customsDutyPkr: string | null; additionalCdPkr: string | null; regulatoryDutyPkr: string | null;
  salesTaxAdjPkr: string | null; salesTaxNonAdjPkr: string | null; whtPkr: string | null; incomeTaxPkr: string | null;
  clearingAgentFeePkr: string | null; documentationChargesPkr: string | null; examinationChargesPkr: string | null;
  thcPkr: string | null; wharfagePkr: string | null; portTrustPkr: string | null;
  scanningFeePkr: string | null; demurragePkr: string | null; detentionPkr: string | null;
  lcChargesPkr: string | null; inlandFreightPkr: string | null;
  otherChargesPkr: string | null; otherChargesDesc: string | null;
  totalDutyTaxesPkr: string | null; totalLandedCostPkr: string | null;
  totalQtyReceived: string | null; qtyUom: string | null; landedCostPerUnitPkr: string | null;
  notes: string | null;
}

interface Props { sheet: Sheet }

const f = (v: string | null | undefined) => parseFloat(v ?? '0');
const fmtPkr = (n: number) => `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">{children}</CardContent>
    </Card>
  );
}

function Row({ label, fieldKey, value, onChange, readonly = false, note }: {
  label: string; fieldKey: string; value: string; onChange: (k: string, v: string) => void; readonly?: boolean; note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-slate-700">{label}</p>
        {note && <p className="text-xs text-teal-600 mt-0.5">{note}</p>}
      </div>
      <div className="w-44">
        <div className="relative">
          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">PKR</span>
          <input
            type="number" step="1" min="0"
            value={value}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            disabled={readonly}
            className={`w-full pl-10 pr-2 py-1.5 text-sm text-right rounded border ${readonly ? 'bg-slate-50 text-slate-400 border-slate-100' : 'border-slate-200 focus:ring-1 focus:ring-teal-400 focus:outline-none'}`}
          />
        </div>
      </div>
    </div>
  );
}

export function CostSheetEditor({ sheet }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, string>>({
    fobValueUsd: sheet.fobValueUsd ?? '0',
    freightUsd: sheet.freightUsd ?? '0',
    insuranceUsd: sheet.insuranceUsd ?? '0',
    cifValueUsd: sheet.cifValueUsd ?? '0',
    exchangeRateApplied: sheet.exchangeRateApplied ?? '1',
    cifValuePkr: sheet.cifValuePkr ?? '0',
    customsDutyPkr: sheet.customsDutyPkr ?? '0',
    additionalCdPkr: sheet.additionalCdPkr ?? '0',
    regulatoryDutyPkr: sheet.regulatoryDutyPkr ?? '0',
    salesTaxAdjPkr: sheet.salesTaxAdjPkr ?? '0',
    salesTaxNonAdjPkr: sheet.salesTaxNonAdjPkr ?? '0',
    whtPkr: sheet.whtPkr ?? '0',
    incomeTaxPkr: sheet.incomeTaxPkr ?? '0',
    clearingAgentFeePkr: sheet.clearingAgentFeePkr ?? '0',
    documentationChargesPkr: sheet.documentationChargesPkr ?? '0',
    examinationChargesPkr: sheet.examinationChargesPkr ?? '0',
    thcPkr: sheet.thcPkr ?? '0',
    wharfagePkr: sheet.wharfagePkr ?? '0',
    portTrustPkr: sheet.portTrustPkr ?? '0',
    scanningFeePkr: sheet.scanningFeePkr ?? '0',
    demurragePkr: sheet.demurragePkr ?? '0',
    detentionPkr: sheet.detentionPkr ?? '0',
    lcChargesPkr: sheet.lcChargesPkr ?? '0',
    inlandFreightPkr: sheet.inlandFreightPkr ?? '0',
    otherChargesPkr: sheet.otherChargesPkr ?? '0',
    totalQtyReceived: sheet.totalQtyReceived ?? '0',
    qtyUom: sheet.qtyUom ?? '',
    otherChargesDesc: sheet.otherChargesDesc ?? '',
    notes: sheet.notes ?? '',
  });

  const update = useCallback((key: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      // Recompute CIF PKR live
      if (key === 'exchangeRateApplied' || key === 'cifValueUsd') {
        next.cifValuePkr = String(parseFloat(next.cifValueUsd) * parseFloat(next.exchangeRateApplied || '1'));
      }
      return next;
    });
  }, []);

  // Live totals
  const totals = useMemo(() => {
    const n = (k: string) => parseFloat(values[k] ?? '0') || 0;
    const duty = n('customsDutyPkr') + n('additionalCdPkr') + n('regulatoryDutyPkr') + n('salesTaxAdjPkr') + n('salesTaxNonAdjPkr') + n('whtPkr') + n('incomeTaxPkr');
    const cf = n('clearingAgentFeePkr') + n('documentationChargesPkr') + n('examinationChargesPkr');
    const port = n('thcPkr') + n('wharfagePkr') + n('portTrustPkr') + n('scanningFeePkr') + n('demurragePkr') + n('detentionPkr');
    const total = n('cifValuePkr') + duty + cf + port + n('lcChargesPkr') + n('inlandFreightPkr') + n('otherChargesPkr');
    const qty = n('totalQtyReceived');
    return { duty, cf, port, total, perUnit: qty > 0 ? total / qty : 0 };
  }, [values]);

  const isFinalized = sheet.status === 'finalized';

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cost-sheet/${sheet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      toast.success('Cost sheet saved');
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doAction = async (action: string) => {
    setActioning(action);
    try {
      const res = await fetch(`/api/cost-sheet/${sheet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      router.refresh();
      toast.success(action === 'finalize' ? 'Cost sheet finalized' : 'Reopened for editing');
    } catch (e: any) { toast.error(e.message); }
    finally { setActioning(null); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Cost sections — left 2 cols */}
      <div className="lg:col-span-2 space-y-4">
        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {!isFinalized && (
            <>
              <Button variant="outline" size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Save Draft
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => doAction('finalize')} disabled={!!actioning}>
                {actioning === 'finalize' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
                Finalize
              </Button>
            </>
          )}
          {isFinalized && (
            <Button size="sm" variant="outline" onClick={() => doAction('reopen')} disabled={!!actioning}>
              {actioning === 'reopen' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Unlock className="mr-1.5 h-3.5 w-3.5 mr-1.5" />}
              Reopen
            </Button>
          )}
        </div>

        {/* CIF section — USD fields + exchange rate */}
        <Section title="Product Cost (CIF)">
          <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
            {[
              { label: 'FOB Value (USD)', key: 'fobValueUsd', prefix: 'USD' },
              { label: 'Freight (USD)', key: 'freightUsd', prefix: 'USD' },
              { label: 'Insurance (USD)', key: 'insuranceUsd', prefix: 'USD' },
              { label: 'CIF Value (USD)', key: 'cifValueUsd', prefix: 'USD' },
              { label: 'Exchange Rate', key: 'exchangeRateApplied', prefix: 'PKR' },
            ].map(({ label, key, prefix }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">{prefix}</span>
                  <input type="number" step="0.0001" min="0" value={values[key] ?? '0'}
                    onChange={(e) => update(key, e.target.value)} disabled={isFinalized}
                    className="w-full pl-10 pr-2 py-1.5 text-sm text-right rounded border border-slate-200 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-slate-50" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm px-1 py-2 bg-slate-50 rounded-lg">
            <span className="font-semibold text-slate-700">CIF Value (PKR)</span>
            <span className="font-bold text-slate-900">{fmtPkr(parseFloat(values.cifValuePkr ?? '0'))}</span>
          </div>
        </Section>

        <Section title="Duty & Taxes">
          <Row label="Customs Duty (CD)" fieldKey="customsDutyPkr" value={values.customsDutyPkr} onChange={update} readonly={isFinalized} note="Auto-filled from GD" />
          <Row label="Additional Customs Duty (ACD)" fieldKey="additionalCdPkr" value={values.additionalCdPkr} onChange={update} readonly={isFinalized} />
          <Row label="Regulatory Duty (RD)" fieldKey="regulatoryDutyPkr" value={values.regulatoryDutyPkr} onChange={update} readonly={isFinalized} />
          <Row label="Sales Tax — Adjustable" fieldKey="salesTaxAdjPkr" value={values.salesTaxAdjPkr} onChange={update} readonly={isFinalized} />
          <Row label="Sales Tax — Non-Adjustable" fieldKey="salesTaxNonAdjPkr" value={values.salesTaxNonAdjPkr} onChange={update} readonly={isFinalized} />
          <Row label="WHT (Withholding Tax)" fieldKey="whtPkr" value={values.whtPkr} onChange={update} readonly={isFinalized} />
          <Row label="Income Tax Advance (Sec. 148)" fieldKey="incomeTaxPkr" value={values.incomeTaxPkr} onChange={update} readonly={isFinalized} />
          <div className="flex justify-between px-1 py-2 bg-slate-50 rounded text-sm mt-1">
            <span className="font-semibold text-slate-700">Total Duty & Taxes</span>
            <span className="font-bold text-slate-900">{fmtPkr(totals.duty)}</span>
          </div>
        </Section>

        <Section title="Clearing & Forwarding">
          <Row label="Clearing Agent Fee" fieldKey="clearingAgentFeePkr" value={values.clearingAgentFeePkr} onChange={update} readonly={isFinalized} />
          <Row label="Documentation Charges" fieldKey="documentationChargesPkr" value={values.documentationChargesPkr} onChange={update} readonly={isFinalized} />
          <Row label="Examination Charges" fieldKey="examinationChargesPkr" value={values.examinationChargesPkr} onChange={update} readonly={isFinalized} note="Auto-filled from GD red channel" />
        </Section>

        <Section title="Port & Terminal Charges">
          <Row label="Terminal Handling Charges (THC)" fieldKey="thcPkr" value={values.thcPkr} onChange={update} readonly={isFinalized} />
          <Row label="Wharfage" fieldKey="wharfagePkr" value={values.wharfagePkr} onChange={update} readonly={isFinalized} />
          <Row label="Port Trust Receipt" fieldKey="portTrustPkr" value={values.portTrustPkr} onChange={update} readonly={isFinalized} />
          <Row label="Scanning Fee" fieldKey="scanningFeePkr" value={values.scanningFeePkr} onChange={update} readonly={isFinalized} />
          <Row label="Demurrage" fieldKey="demurragePkr" value={values.demurragePkr} onChange={update} readonly={isFinalized} />
          <Row label="Detention" fieldKey="detentionPkr" value={values.detentionPkr} onChange={update} readonly={isFinalized} />
        </Section>

        <Section title="Bank / LC Charges">
          <Row label="Total LC Bank Charges" fieldKey="lcChargesPkr" value={values.lcChargesPkr} onChange={update} readonly={isFinalized} note="Auto-summed from LC charges log" />
        </Section>

        <Section title="Inland Transport">
          <Row label="Freight — Port to Warehouse" fieldKey="inlandFreightPkr" value={values.inlandFreightPkr} onChange={update} readonly={isFinalized} />
        </Section>

        <Section title="Other Charges">
          <Row label="Other Charges" fieldKey="otherChargesPkr" value={values.otherChargesPkr} onChange={update} readonly={isFinalized} />
          <div className="pt-1">
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <input value={values.otherChargesDesc} onChange={(e) => update('otherChargesDesc', e.target.value)} disabled={isFinalized}
              placeholder="Describe any other charges…" className="w-full border rounded px-3 py-1.5 text-sm disabled:bg-slate-50" />
          </div>
        </Section>
      </div>

      {/* Right sidebar — totals + per-unit */}
      <div className="space-y-4">
        {/* Grand total card */}
        <Card className="bg-slate-800 border-0 sticky top-4">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'CIF Value', value: parseFloat(values.cifValuePkr ?? '0'), color: 'text-slate-300' },
                { label: 'Duty & Taxes', value: totals.duty, color: 'text-red-300' },
                { label: 'Clearing & Fwd.', value: totals.cf, color: 'text-slate-300' },
                { label: 'Port & Terminal', value: totals.port, color: 'text-slate-300' },
                { label: 'LC Bank Charges', value: parseFloat(values.lcChargesPkr ?? '0'), color: 'text-slate-300' },
                { label: 'Inland Freight', value: parseFloat(values.inlandFreightPkr ?? '0'), color: 'text-slate-300' },
                { label: 'Other', value: parseFloat(values.otherChargesPkr ?? '0'), color: 'text-slate-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-400">{label}</span>
                  <span className={`font-medium ${color}`}>{fmtPkr(value)}</span>
                </div>
              ))}
              <div className="border-t border-slate-600 pt-3">
                <div className="flex justify-between items-end">
                  <span className="text-white font-semibold text-sm">Total Landed Cost</span>
                  <span className="text-teal-300 font-bold text-lg">{fmtPkr(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Qty / per-unit */}
            <div className="border-t border-slate-600 pt-3 space-y-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Quantity Received</p>
              <div className="flex gap-2">
                <input type="number" step="0.001" min="0" value={values.totalQtyReceived} onChange={(e) => update('totalQtyReceived', e.target.value)}
                  disabled={isFinalized}
                  className="flex-1 border border-slate-600 bg-slate-700 text-white rounded px-2 py-1.5 text-sm text-right disabled:opacity-60" />
                <input value={values.qtyUom} onChange={(e) => update('qtyUom', e.target.value)} disabled={isFinalized}
                  placeholder="UOM" className="w-16 border border-slate-600 bg-slate-700 text-white rounded px-2 py-1.5 text-sm disabled:opacity-60" />
              </div>
              {totals.perUnit > 0 && (
                <div className="p-3 bg-teal-900 rounded-lg text-center">
                  <p className="text-xs text-teal-400">Landed Cost / {values.qtyUom || 'unit'}</p>
                  <p className="text-xl font-bold text-white mt-1">PKR {totals.perUnit.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="border-t border-slate-600 pt-3">
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <textarea value={values.notes} onChange={(e) => update('notes', e.target.value)} disabled={isFinalized} rows={2}
                className="w-full border border-slate-600 bg-slate-700 text-white text-xs rounded px-2 py-1.5 resize-none disabled:opacity-60" />
            </div>
          </CardContent>
        </Card>

        {isFinalized && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-700 text-sm">Finalized</p>
                <p className="text-xs text-green-600 mt-0.5">Cost sheet is locked. Click Reopen to edit.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
