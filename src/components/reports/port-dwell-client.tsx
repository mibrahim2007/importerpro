'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface PortStat {
  port: string | null; count: number;
  avgDwellDays: string | null; maxDwellDays: number | null;
}
interface ShipmentRow {
  shipmentId: string; shipmentNo: string; portOfDischarge: string | null;
  ata: string | null; eta: string | null; status: string | null; doReleasedDate: string | null;
}
interface DemurrageStat {
  shipmentId: string; containerCount: number; demurrageCount: number; totalDemurrage: string;
}

interface Props { portStats: PortStat[]; shipmentRows: ShipmentRow[]; demurrageStats: DemurrageStat[] }

const MS_DAY = 86_400_000;

export function PortDwellClient({ portStats, shipmentRows, demurrageStats }: Props) {
  const demurrageByShipment = Object.fromEntries(demurrageStats.map((d) => [d.shipmentId, d]));

  const totalDemurrage = demurrageStats.reduce((s, d) => s + parseFloat(d.totalDemurrage), 0);
  const incidentCount = demurrageStats.filter((d) => d.demurrageCount > 0).length;

  const shipmentData = shipmentRows.map((s) => {
    const start = s.ata ? new Date(s.ata) : null;
    const end = s.doReleasedDate ? new Date(s.doReleasedDate) : start ? new Date() : null;
    const dwell = start && end ? Math.floor((end.getTime() - start.getTime()) / MS_DAY) : null;
    return { ...s, dwellDays: dwell };
  }).filter((s) => s.dwellDays !== null);

  const handleExport = () => downloadCsv('port-dwell.csv', shipmentData.map((s) => ({
    'Shipment': s.shipmentNo, 'Port': s.portOfDischarge ?? '', 'ATA': s.ata ?? '',
    'DO Released': s.doReleasedDate ?? '', 'Dwell Days': s.dwellDays ?? '',
    'Demurrage USD': demurrageByShipment[s.shipmentId]?.totalDemurrage ?? '0',
  })));

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-slate-400 mb-1">Total Demurrage Paid</p>
            <p className="text-2xl font-bold text-red-600">${totalDemurrage.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-slate-400 mb-1">Demurrage Incidents</p>
            <p className="text-2xl font-bold text-slate-800">{incidentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-slate-400 mb-1">Shipments Tracked</p>
            <p className="text-2xl font-bold text-slate-800">{shipmentRows.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Port aggregation */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">By Port of Discharge</CardTitle>
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Port', 'Shipments', 'Avg Dwell (ATA→DO)', 'Max Dwell', 'Assessment'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portStats.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">No data yet</td></tr>}
              {portStats.map((p, i) => {
                const avg = p.avgDwellDays ? Math.round(parseFloat(p.avgDwellDays)) : null;
                return (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.port ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-center font-mono">{p.count}</td>
                    <td className="px-4 py-3 text-center">
                      {avg !== null ? (
                        <span className={avg > 10 ? 'text-red-600 font-bold' : avg > 5 ? 'text-amber-600 font-semibold' : 'text-green-600'}>
                          {avg} days
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">{p.maxDwellDays ?? '—'}</td>
                    <td className="px-4 py-3">
                      {avg !== null && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${avg > 10 ? 'bg-red-100 text-red-700' : avg > 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {avg > 10 ? 'Poor' : avg > 5 ? 'Average' : 'Good'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Shipment detail */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Shipment Detail</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Shipment', 'Port', 'ATA', 'DO Released', 'Dwell Days', 'Demurrage (USD)'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shipmentData.sort((a, b) => (b.dwellDays ?? 0) - (a.dwellDays ?? 0)).map((s) => {
                const dm = demurrageByShipment[s.shipmentId];
                return (
                  <tr key={s.shipmentId} className={`border-b hover:bg-slate-50 ${(s.dwellDays ?? 0) > 10 ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{s.shipmentNo}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{s.portOfDischarge ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{s.ata ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{s.doReleasedDate ?? 'Pending'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono font-semibold ${(s.dwellDays ?? 0) > 10 ? 'text-red-600' : (s.dwellDays ?? 0) > 5 ? 'text-amber-600' : 'text-green-600'}`}>
                        {s.dwellDays}d{!s.doReleasedDate ? ' *' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {dm?.totalDemurrage && parseFloat(dm.totalDemurrage) > 0 ? (
                        <span className="text-red-600">${parseFloat(dm.totalDemurrage).toLocaleString()}</span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 px-4 py-2">* Ongoing — calculated to today</p>
        </CardContent>
      </Card>
    </div>
  );
}
