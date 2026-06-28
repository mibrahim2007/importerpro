'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface Gd {
  gdId: string; gdNo: string | null; gdDate: string | null; customsStation: string | null;
  exchangeRate: string | null; psidDate: string | null;
  totalAssessableValuePkr: string | null; totalCustomsDutyPkr: string | null;
  totalSalesTaxPkr: string | null; totalOtherDutyPkr: string | null; totalPayablePkr: string | null;
  gdStatus: string | null; supplierName: string | null; supplierCountry: string | null; shipmentNo: string | null;
}
interface Line {
  gdId: string; hsCode: string | null; description: string | null;
  assessableValuePkr: string | null; cdPkr: string | null; acdPkr: string | null;
  rdPkr: string | null; stPkr: string | null; whtPkr: string | null; itAdvPkr: string | null; totalDutyPkr: string | null;
}
interface Props { gds: Gd[]; linesByGd: Record<string, Line[]> }

const pkr = (v: string | null) => v ? parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';

export function DutyRegisterClient({ gds, linesByGd }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [monthFilter, setMonthFilter] = useState('all');

  const months = useMemo(() => {
    const s = new Set(gds.map((g) => g.gdDate?.slice(0, 7)).filter(Boolean) as string[]);
    return Array.from(s).sort().reverse();
  }, [gds]);

  const filtered = monthFilter === 'all' ? gds : gds.filter((g) => g.gdDate?.startsWith(monthFilter));

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleExport = () => downloadCsv('duty-register.csv', filtered.flatMap((g) =>
    (linesByGd[g.gdId] ?? [{ hsCode: '', description: '', assessableValuePkr: null, cdPkr: null, acdPkr: null, rdPkr: null, stPkr: null, whtPkr: null, itAdvPkr: null, totalDutyPkr: null }]).map((l) => ({
      'GD No': g.gdNo ?? '', 'GD Date': g.gdDate ?? '', 'Station': g.customsStation ?? '',
      'Supplier': g.supplierName ?? '', 'Country': g.supplierCountry ?? '', 'Shipment': g.shipmentNo ?? '',
      'HS Code': l.hsCode ?? '', 'Description': l.description ?? '',
      'Assessable Value PKR': l.assessableValuePkr ?? '', 'CD PKR': l.cdPkr ?? '',
      'ACD PKR': l.acdPkr ?? '', 'RD PKR': l.rdPkr ?? '', 'ST PKR': l.stPkr ?? '',
      'WHT PKR': l.whtPkr ?? '', 'IT Adv PKR': l.itAdvPkr ?? '', 'Total Duty PKR': l.totalDutyPkr ?? '',
      'PSID Date': g.psidDate ?? '', 'Status': g.gdStatus ?? '',
    }))
  ));

  const grandTotalPayable = filtered.reduce((s, g) => s + parseFloat(g.totalPayablePkr ?? '0'), 0);
  const grandTotalDuty = filtered.reduce((s, g) => s + parseFloat(g.totalCustomsDutyPkr ?? '0'), 0);
  const grandTotalST = filtered.reduce((s, g) => s + parseFloat(g.totalSalesTaxPkr ?? '0'), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Months</option>
          {months.map((m) => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
        <div className="ml-auto flex gap-6 text-sm">
          <div className="text-center"><p className="text-xs text-slate-400">Total CD</p><p className="font-mono font-semibold text-slate-800">{pkr(String(grandTotalDuty))}</p></div>
          <div className="text-center"><p className="text-xs text-slate-400">Total ST</p><p className="font-mono font-semibold text-slate-800">{pkr(String(grandTotalST))}</p></div>
          <div className="text-center"><p className="text-xs text-slate-400">Grand Total</p><p className="font-mono font-bold text-teal-700">{pkr(String(grandTotalPayable))}</p></div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-3 py-2.5 text-left font-medium text-slate-500 w-8"></th>
                {['GD No', 'Date', 'Supplier', 'Country', 'Station', 'Assessable', 'CD', 'ST', 'Other', 'Total Payable', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={12} className="text-center py-12 text-slate-400">No GDs found</td></tr>}
              {filtered.map((g) => {
                const isExpanded = expanded.has(g.gdId);
                const gLines = linesByGd[g.gdId] ?? [];
                return (
                  <>
                    <tr key={g.gdId} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => gLines.length > 0 && toggle(g.gdId)}>
                      <td className="px-3 py-2.5">
                        {gLines.length > 0 && (isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-700">{g.gdNo ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{g.gdDate ?? '—'}</td>
                      <td className="px-3 py-2.5">{g.supplierName ?? '—'}</td>
                      <td className="px-3 py-2.5">{g.supplierCountry ?? '—'}</td>
                      <td className="px-3 py-2.5">{g.customsStation ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-right">{pkr(g.totalAssessableValuePkr)}</td>
                      <td className="px-3 py-2.5 font-mono text-right">{pkr(g.totalCustomsDutyPkr)}</td>
                      <td className="px-3 py-2.5 font-mono text-right">{pkr(g.totalSalesTaxPkr)}</td>
                      <td className="px-3 py-2.5 font-mono text-right">{pkr(g.totalOtherDutyPkr)}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-right text-slate-800">{pkr(g.totalPayablePkr)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${g.psidDate ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                          {g.psidDate ? 'Duty Paid' : (g.gdStatus ?? '').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && gLines.map((l, i) => (
                      <tr key={i} className="bg-slate-50 border-b text-slate-500">
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 font-mono">{l.hsCode ?? '—'}</td>
                        <td className="px-3 py-2" colSpan={4}>{l.description ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-right">{pkr(l.assessableValuePkr)}</td>
                        <td className="px-3 py-2 font-mono text-right">{pkr(l.cdPkr)}</td>
                        <td className="px-3 py-2 font-mono text-right">{pkr(l.stPkr)}</td>
                        <td className="px-3 py-2 font-mono text-right">{pkr(l.rdPkr)}</td>
                        <td className="px-3 py-2 font-mono font-medium text-right text-slate-700">{pkr(l.totalDutyPkr)}</td>
                        <td></td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
