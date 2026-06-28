'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface Row {
  id: string; costSheetNo: string; status: string | null; shipmentNo: string | null;
  supplierName: string | null; supplierCountry: string | null;
  fobValueUsd: string | null; cifValueUsd: string | null; cifValuePkr: string | null;
  exchangeRateApplied: string | null; totalDutyTaxesPkr: string | null;
  clearingAgentFeePkr: string | null; documentationChargesPkr: string | null;
  examinationChargesPkr: string | null; thcPkr: string | null; wharfagePkr: string | null;
  lcChargesPkr: string | null; inlandFreightPkr: string | null;
  totalLandedCostPkr: string | null; totalQtyReceived: string | null;
  qtyUom: string | null; landedCostPerUnitPkr: string | null; createdAt: Date | null;
}

const pkr = (v: string | null) => v ? parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
const usd = (v: string | null) => v ? `$${parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 0 })}` : '—';

interface Props { rows: Row[] }

export function LandedCostReportClient({ rows }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleExport = () => downloadCsv('landed-cost-report.csv', rows.map((r) => ({
    'Sheet No': r.costSheetNo, 'Shipment': r.shipmentNo ?? '', 'Supplier': r.supplierName ?? '',
    'FOB USD': r.fobValueUsd ?? '', 'CIF USD': r.cifValueUsd ?? '', 'Exchange Rate': r.exchangeRateApplied ?? '',
    'CIF PKR': r.cifValuePkr ?? '', 'Duty & Taxes PKR': r.totalDutyTaxesPkr ?? '',
    'Clearing PKR': r.clearingAgentFeePkr ?? '', 'Port PKR': r.thcPkr ?? '',
    'LC Charges PKR': r.lcChargesPkr ?? '', 'Inland PKR': r.inlandFreightPkr ?? '',
    'Total Landed PKR': r.totalLandedCostPkr ?? '', 'Qty': r.totalQtyReceived ?? '',
    'UOM': r.qtyUom ?? '', 'Per Unit PKR': r.landedCostPerUnitPkr ?? '', 'Status': r.status ?? '',
  })));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
        <span className="text-xs text-slate-400">{rows.length} cost sheet{rows.length !== 1 ? 's' : ''}</span>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Sheet No', 'Shipment / Supplier', 'CIF USD', 'CIF PKR', 'Duty & Tax', 'Clearing', 'Port', 'LC Charges', 'Inland', 'Total Landed', 'Qty', 'Per Unit PKR', 'Status'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={13} className="text-center py-10 text-slate-400">No cost sheets found</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <Link href={`/import/cost-sheet/${r.id}`} className="font-mono text-teal-700 hover:underline">{r.costSheetNo}</Link>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-mono text-slate-600">{r.shipmentNo ?? '—'}</p>
                    <p className="text-slate-400">{r.supplierName ?? ''}</p>
                  </td>
                  <td className="px-3 py-3 font-mono">{usd(r.cifValueUsd)}</td>
                  <td className="px-3 py-3 font-mono">{pkr(r.cifValuePkr)}</td>
                  <td className="px-3 py-3 font-mono">{pkr(r.totalDutyTaxesPkr)}</td>
                  <td className="px-3 py-3 font-mono">{pkr(r.clearingAgentFeePkr)}</td>
                  <td className="px-3 py-3 font-mono">{pkr(r.thcPkr)}</td>
                  <td className="px-3 py-3 font-mono">{pkr(r.lcChargesPkr)}</td>
                  <td className="px-3 py-3 font-mono">{pkr(r.inlandFreightPkr)}</td>
                  <td className="px-3 py-3 font-mono font-bold text-teal-700">{pkr(r.totalLandedCostPkr)}</td>
                  <td className="px-3 py-3 text-slate-600">{r.totalQtyReceived ? `${r.totalQtyReceived} ${r.qtyUom ?? ''}` : '—'}</td>
                  <td className="px-3 py-3 font-mono font-semibold text-slate-800">{pkr(r.landedCostPerUnitPkr)}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.status ?? 'draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
