'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Calculator } from 'lucide-react';

export interface GdLine {
  hsCode: string;
  commodityDescription: string;
  countryOfOrigin: string;
  qty: string;
  uom: string;
  cifValuePkr: string;
  assessableValuePkr: string;
  customsDutyPct: string;
  additionalCdPct: string;
  regulatoryDutyPct: string;
  salesTaxPct: string;
  whtPct: string;
  incomeTaxPct: string;
  antiDumpingDutyPkr: string;
  sroDeductionPkr: string;
}

const BLANK_LINE: GdLine = {
  hsCode: '', commodityDescription: '', countryOfOrigin: 'CN',
  qty: '', uom: 'KG', cifValuePkr: '', assessableValuePkr: '',
  customsDutyPct: '20', additionalCdPct: '0', regulatoryDutyPct: '0',
  salesTaxPct: '17', whtPct: '1', incomeTaxPct: '5.5',
  antiDumpingDutyPkr: '', sroDeductionPkr: '',
};

function calcLine(l: GdLine) {
  const assessable = Number(l.assessableValuePkr || l.cifValuePkr || 0);
  const cd = (assessable * Number(l.customsDutyPct || 0)) / 100;
  const acd = (assessable * Number(l.additionalCdPct || 0)) / 100;
  const rd = (assessable * Number(l.regulatoryDutyPct || 0)) / 100;
  const baseForST = assessable + cd + acd + rd;
  const st = (baseForST * Number(l.salesTaxPct || 17)) / 100;
  const wht = (assessable * Number(l.whtPct || 0)) / 100;
  const it = (assessable * Number(l.incomeTaxPct || 0)) / 100;
  const ad = Number(l.antiDumpingDutyPkr || 0);
  const sro = Number(l.sroDeductionPkr || 0);
  const total = cd + acd + rd + st + wht + it + ad - sro;
  return { assessable, cd, acd, rd, st, wht, it, ad, sro, total };
}

interface Props {
  lines: GdLine[];
  onChange: (lines: GdLine[]) => void;
  exchangeRate: string;
}

export function GdDutyCalculator({ lines, onChange, exchangeRate }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const addLine = () => {
    onChange([...lines, { ...BLANK_LINE }]);
    setExpandedIdx(lines.length);
  };

  const updateLine = (i: number, k: keyof GdLine, v: string) => {
    const updated = lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l);
    // Auto-set assessable = cif if assessable is empty
    if (k === 'cifValuePkr' && !updated[i].assessableValuePkr) {
      updated[i].assessableValuePkr = v;
    }
    onChange(updated);
  };

  const removeLine = (i: number) => {
    onChange(lines.filter((_, idx) => idx !== i));
    setExpandedIdx(null);
  };

  const totals = useMemo(() => {
    return lines.reduce((acc, l) => {
      const c = calcLine(l);
      return {
        assessable: acc.assessable + c.assessable,
        cd: acc.cd + c.cd,
        acd: acc.acd + c.acd,
        rd: acc.rd + c.rd,
        st: acc.st + c.st,
        wht: acc.wht + c.wht,
        it: acc.it + c.it,
        ad: acc.ad + c.ad,
        sro: acc.sro + c.sro,
        total: acc.total + c.total,
      };
    }, { assessable: 0, cd: 0, acd: 0, rd: 0, st: 0, wht: 0, it: 0, ad: 0, sro: 0, total: 0 });
  }, [lines]);

  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      {/* Lines */}
      <div className="space-y-2">
        {lines.map((l, i) => {
          const c = calcLine(l);
          const isOpen = expandedIdx === i;
          return (
            <div key={i} className="border rounded-lg overflow-hidden">
              {/* Collapsed header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100"
                onClick={() => setExpandedIdx(isOpen ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-slate-200 px-2 py-0.5 rounded">{l.hsCode || 'HS Code'}</span>
                  <span className="text-sm text-slate-700 font-medium">{l.commodityDescription || 'New Line'}</span>
                  {l.qty && <span className="text-xs text-slate-400">{l.qty} {l.uom}</span>}
                </div>
                <div className="flex items-center gap-4">
                  {c.assessable > 0 && (
                    <div className="text-right text-xs">
                      <p className="text-slate-500">Assessable: ₨ {fmt(c.assessable)}</p>
                      <p className="font-bold text-red-700">Total Duty: ₨ {fmt(c.total)}</p>
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeLine(i); }}
                    className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="p-4 space-y-4">
                  {/* Basic fields */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">HS Code (8-digit) <span className="text-red-500">*</span></Label>
                      <Input className="font-mono text-xs" placeholder="e.g. 39039010" value={l.hsCode}
                        onChange={(e) => updateLine(i, 'hsCode', e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Commodity Description <span className="text-red-500">*</span></Label>
                      <Input className="text-xs" placeholder="As per customs tariff" value={l.commodityDescription}
                        onChange={(e) => updateLine(i, 'commodityDescription', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Country of Origin</Label>
                      <Input className="text-xs" placeholder="CN / DE / KR" value={l.countryOfOrigin}
                        onChange={(e) => updateLine(i, 'countryOfOrigin', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantity</Label>
                      <div className="flex gap-1">
                        <Input type="number" className="flex-1 text-xs" value={l.qty}
                          onChange={(e) => updateLine(i, 'qty', e.target.value)} />
                        <select className="w-20 border rounded-md px-1 text-xs bg-white"
                          value={l.uom} onChange={(e) => updateLine(i, 'uom', e.target.value)}>
                          {['KG', 'MT', 'Bags', 'Drums', 'Cartons', 'Units', 'Liters'].map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CIF Value (PKR) <span className="text-red-500">*</span></Label>
                      <Input type="number" className="text-xs" placeholder="0" value={l.cifValuePkr}
                        onChange={(e) => updateLine(i, 'cifValuePkr', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Assessable Value (PKR)</Label>
                      <Input type="number" className="text-xs" placeholder="= CIF if blank" value={l.assessableValuePkr}
                        onChange={(e) => updateLine(i, 'assessableValuePkr', e.target.value)} />
                    </div>
                  </div>

                  {/* Duty rates */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                      <Calculator className="h-3.5 w-3.5" /> Duty Rates & Computation
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Customs Duty (%)', key: 'customsDutyPct' as const, computed: c.cd },
                        { label: 'Additional CD (%)', key: 'additionalCdPct' as const, computed: c.acd },
                        { label: 'Regulatory Duty (%)', key: 'regulatoryDutyPct' as const, computed: c.rd },
                        { label: 'Sales Tax (%)', key: 'salesTaxPct' as const, computed: c.st },
                        { label: 'WHT (%)', key: 'whtPct' as const, computed: c.wht },
                        { label: 'Income Tax Adv. (%)', key: 'incomeTaxPct' as const, computed: c.it },
                      ].map(({ label, key, computed }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input type="number" step="0.01" className="text-xs" value={l[key]}
                            onChange={(e) => updateLine(i, key, e.target.value)} />
                          {computed > 0 && <p className="text-xs text-blue-600">₨ {fmt(computed)}</p>}
                        </div>
                      ))}
                      <div className="space-y-1">
                        <Label className="text-xs">Anti-Dumping Duty (PKR)</Label>
                        <Input type="number" className="text-xs" placeholder="0" value={l.antiDumpingDutyPkr}
                          onChange={(e) => updateLine(i, 'antiDumpingDutyPkr', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">SRO Deduction (PKR)</Label>
                        <Input type="number" className="text-xs" placeholder="0" value={l.sroDeductionPkr}
                          onChange={(e) => updateLine(i, 'sroDeductionPkr', e.target.value)} />
                        {c.sro > 0 && <p className="text-xs text-green-600">−₨ {fmt(c.sro)}</p>}
                      </div>
                    </div>

                    {/* Line summary */}
                    {c.assessable > 0 && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-xs text-center">
                        {[
                          { label: 'CD', value: c.cd },
                          { label: 'ST', value: c.st },
                          { label: 'Other', value: c.acd + c.rd + c.wht + c.it + c.ad },
                          { label: 'Total', value: c.total },
                        ].map(({ label, value }) => (
                          <div key={label} className={`rounded p-1.5 ${label === 'Total' ? 'bg-red-100' : 'bg-white'}`}>
                            <p className="text-slate-400">{label}</p>
                            <p className={`font-bold ${label === 'Total' ? 'text-red-700' : 'text-slate-700'}`}>₨ {fmt(value)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add GD Line
      </Button>

      {/* Grand total */}
      {lines.length > 0 && totals.assessable > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Total Assessable', value: totals.assessable, color: 'text-slate-300' },
            { label: 'Customs Duty', value: totals.cd, color: 'text-blue-300' },
            { label: 'Sales Tax', value: totals.st, color: 'text-amber-300' },
            { label: 'Net Payable', value: totals.total, color: 'text-red-300', big: true },
          ].map(({ label, value, color, big }) => (
            <div key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`font-bold mt-1 ${color} ${big ? 'text-xl' : 'text-base'}`}>₨ {fmt(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
