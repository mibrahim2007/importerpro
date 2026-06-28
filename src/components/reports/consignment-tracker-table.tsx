'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Search } from 'lucide-react';
import { downloadCsv } from '@/lib/reports/csv';

interface Row {
  shipmentId: string; shipmentNo: string; vesselName: string | null; portOfDischarge: string | null;
  eta: string | null; ata: string | null; shipmentStatus: string | null;
  poNo: string | null; supplierName: string | null; supplierCountry: string | null; cifValueUsd: string | null;
  gdNo: string | null; psidDate: string | null; gdStatus: string | null;
  grnNo: string | null; grnDate: string | null; grnStatus: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  booked: 'bg-blue-100 text-blue-700',
  sailing: 'bg-cyan-100 text-cyan-700',
  arrived: 'bg-amber-100 text-amber-700',
  do_released: 'bg-orange-100 text-orange-700',
  customs_cleared: 'bg-purple-100 text-purple-700',
  grn_done: 'bg-green-100 text-green-700',
};

const MS_DAY = 86_400_000;

interface Props { rows: Row[] }

export function ConsignmentTrackerTable({ rows }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.shipmentStatus !== statusFilter) return false;
      if (!q) return true;
      return [r.shipmentNo, r.vesselName, r.poNo, r.supplierName, r.portOfDischarge, r.gdNo]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const daysAtPort = (r: Row) => {
    if (!r.ata) return null;
    const end = r.grnDate ? new Date(r.grnDate) : new Date();
    return Math.floor((end.getTime() - new Date(r.ata).getTime()) / MS_DAY);
  };

  const handleExport = () => downloadCsv('consignment-tracker.csv', filtered.map((r) => ({
    'Shipment No': r.shipmentNo,
    'Vessel': r.vesselName ?? '',
    'Port': r.portOfDischarge ?? '',
    'PO No': r.poNo ?? '',
    'Supplier': r.supplierName ?? '',
    'Country': r.supplierCountry ?? '',
    'CIF USD': r.cifValueUsd ?? '',
    'Status': r.shipmentStatus ?? '',
    'ETA': r.eta ?? '',
    'ATA': r.ata ?? '',
    'Days at Port': daysAtPort(r) ?? '',
    'GD No': r.gdNo ?? '',
    'Duty Paid': r.psidDate ? 'Yes' : 'No',
    'GRN No': r.grnNo ?? '',
    'GRN Date': r.grnDate ?? '',
  })));

  const STATUSES = ['all', 'booked', 'sailing', 'arrived', 'do_released', 'customs_cleared', 'grn_done'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search consignment, vessel, supplier, GD…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" />CSV
        </Button>
      </div>
      <p className="text-xs text-slate-400">{filtered.length} consignment{filtered.length !== 1 ? 's' : ''}</p>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Shipment', 'Vessel / Port', 'PO / Supplier', 'CIF (USD)', 'Status', 'ETA', 'Days at Port', 'GD / Duty', 'GRN'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium text-slate-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No consignments found</td></tr>
              )}
              {filtered.map((r) => {
                const days = daysAtPort(r);
                return (
                  <tr key={r.shipmentId} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link href={`/import/shipments/${r.shipmentId}`} className="font-mono text-teal-700 hover:underline text-xs">{r.shipmentNo}</Link>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="font-medium text-slate-700">{r.vesselName ?? '—'}</p>
                      <p className="text-slate-400">{r.portOfDischarge ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="font-mono text-slate-600">{r.poNo ?? '—'}</p>
                      <p className="text-slate-400">{r.supplierName ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono">{r.cifValueUsd ? `$${parseFloat(r.cifValueUsd).toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_BADGE[r.shipmentStatus ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                        {(r.shipmentStatus ?? '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{r.eta ?? '—'}</td>
                    <td className="px-3 py-3 text-xs">
                      {days !== null ? (
                        <span className={days > 14 ? 'text-red-600 font-semibold' : days > 7 ? 'text-amber-600' : 'text-slate-600'}>
                          {days}d
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="font-mono text-slate-600">{r.gdNo ?? '—'}</p>
                      {r.psidDate && <p className="text-green-600">Paid {r.psidDate}</p>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {r.grnNo ? (
                        <Link href={`/import/grn`} className="text-teal-700 hover:underline font-mono">{r.grnNo}</Link>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
