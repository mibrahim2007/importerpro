'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const QUALITY_RESULTS = [
  { value: 'resaleable', label: 'Resaleable', color: 'text-green-700' },
  { value: 'damaged', label: 'Damaged', color: 'text-amber-700' },
  { value: 'destroyed', label: 'Destroyed', color: 'text-red-700' },
  { value: 'mixed', label: 'Mixed (see breakdown)', color: 'text-slate-700' },
];

interface RaLine {
  id: string;
  productId?: string | null;
  description: string;
  returnQty: string | null;
  uom?: string | null;
  lotNo?: string | null;
  productName?: string | null;
}
interface Warehouse { id: string; name: string }

interface GrnLine {
  raLineId: string;
  productId?: string;
  description: string;
  expectedQty: string;
  receivedQty: string;
  resaleableQty: string;
  damagedQty: string;
  destroyedQty: string;
  qualityResult: string;
  qualityNotes: string;
  lotNo: string;
  uom: string;
}

interface Props {
  raId: string;
  raNo: string;
  raLines: RaLine[];
  warehouses: Warehouse[];
}

export function ReturnGrnForm({ raId, raNo, raLines, warehouses }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState('');
  const [inspectorNotes, setInspectorNotes] = useState('');

  const [lines, setLines] = useState<GrnLine[]>(() =>
    raLines.map(l => ({
      raLineId: l.id,
      productId: l.productId ?? undefined,
      description: l.productName ?? l.description,
      expectedQty: l.returnQty ?? '',
      receivedQty: l.returnQty ?? '',
      resaleableQty: l.returnQty ?? '',
      damagedQty: '0',
      destroyedQty: '0',
      qualityResult: 'resaleable',
      qualityNotes: '',
      lotNo: l.lotNo ?? '',
      uom: l.uom ?? '',
    }))
  );

  function updateLine(i: number, field: keyof GrnLine, value: string) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      // Auto-set quality distribution when qualityResult changes
      if (field === 'qualityResult') {
        const recv = parseFloat(updated.receivedQty || '0');
        if (value === 'resaleable') {
          updated.resaleableQty = String(recv);
          updated.damagedQty = '0';
          updated.destroyedQty = '0';
        } else if (value === 'damaged') {
          updated.resaleableQty = '0';
          updated.damagedQty = String(recv);
          updated.destroyedQty = '0';
        } else if (value === 'destroyed') {
          updated.resaleableQty = '0';
          updated.damagedQty = '0';
          updated.destroyedQty = String(recv);
        }
      }
      return updated;
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receivedDate) { setError('Received date is required'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/returns/${raId}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedDate,
          warehouseId: warehouseId || null,
          inspectorNotes: inspectorNotes || null,
          lines: lines.map(l => ({
            raLineId: l.raLineId,
            productId: l.productId,
            description: l.description,
            expectedQty: parseFloat(l.expectedQty) || null,
            receivedQty: parseFloat(l.receivedQty) || 0,
            resaleableQty: parseFloat(l.resaleableQty) || 0,
            damagedQty: parseFloat(l.damagedQty) || 0,
            destroyedQty: parseFloat(l.destroyedQty) || 0,
            qualityResult: l.qualityResult,
            qualityNotes: l.qualityNotes || null,
            lotNo: l.lotNo || null,
            uom: l.uom || null,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Save failed');
      }
      router.push(`/sales/returns/${raId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalResaleable = lines.reduce((s, l) => s + parseFloat(l.resaleableQty || '0'), 0);
  const totalDamaged = lines.reduce((s, l) => s + parseFloat(l.damagedQty || '0'), 0);
  const totalDestroyed = lines.reduce((s, l) => s + parseFloat(l.destroyedQty || '0'), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* GRN Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Receipt Details</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Received Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Receiving Warehouse</Label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select warehouse (for stock update)…</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Inspector Notes</Label>
            <Input value={inspectorNotes} onChange={e => setInspectorNotes(e.target.value)} placeholder="Quality inspection summary…" />
          </div>
        </div>
      </div>

      {/* Lines with quality inspection */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Quality Inspection per Item</h2>
          <p className="text-xs text-slate-500 mt-0.5">Resaleable qty → stock restocked · Damaged → quarantine · Destroyed → written off</p>
        </div>
        <div className="space-y-4 p-5">
          {lines.length === 0 && <p className="text-center text-slate-400 py-8">No items in this RA</p>}
          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{l.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Expected: {l.expectedQty} {l.uom}</p>
                </div>
                <select
                  value={l.qualityResult}
                  onChange={e => updateLine(i, 'qualityResult', e.target.value)}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {QUALITY_RESULTS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-5 gap-3 text-sm">
                <div className="space-y-1">
                  <Label className="text-xs">Received Qty</Label>
                  <Input
                    type="number" value={l.receivedQty}
                    onChange={e => updateLine(i, 'receivedQty', e.target.value)}
                    placeholder="Qty" min="0" step="0.001" required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-green-700">Resaleable Qty</Label>
                  <Input
                    type="number" value={l.resaleableQty}
                    onChange={e => updateLine(i, 'resaleableQty', e.target.value)}
                    placeholder="0" min="0" step="0.001"
                    className="border-green-300 focus:ring-green-500"
                    disabled={l.qualityResult !== 'mixed' && l.qualityResult !== 'resaleable'}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-amber-700">Damaged Qty</Label>
                  <Input
                    type="number" value={l.damagedQty}
                    onChange={e => updateLine(i, 'damagedQty', e.target.value)}
                    placeholder="0" min="0" step="0.001"
                    className="border-amber-300 focus:ring-amber-500"
                    disabled={l.qualityResult !== 'mixed' && l.qualityResult !== 'damaged'}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-red-700">Destroyed Qty</Label>
                  <Input
                    type="number" value={l.destroyedQty}
                    onChange={e => updateLine(i, 'destroyedQty', e.target.value)}
                    placeholder="0" min="0" step="0.001"
                    className="border-red-300 focus:ring-red-500"
                    disabled={l.qualityResult !== 'mixed' && l.qualityResult !== 'destroyed'}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lot No</Label>
                  <Input value={l.lotNo} onChange={e => updateLine(i, 'lotNo', e.target.value)} placeholder="Lot #" />
                </div>
              </div>
              {l.qualityNotes !== undefined && (
                <Input
                  value={l.qualityNotes}
                  onChange={e => updateLine(i, 'qualityNotes', e.target.value)}
                  placeholder="Quality notes for this item…"
                  className="text-xs"
                />
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        {lines.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-8 text-sm">
              <div><span className="text-slate-500">Total Received:</span> <strong>{lines.reduce((s, l) => s + parseFloat(l.receivedQty || '0'), 0).toLocaleString()}</strong></div>
              <div className="text-green-700"><span className="text-slate-500">Resaleable:</span> <strong>{totalResaleable.toLocaleString()}</strong></div>
              <div className="text-amber-700"><span className="text-slate-500">Damaged:</span> <strong>{totalDamaged.toLocaleString()}</strong></div>
              <div className="text-red-700"><span className="text-slate-500">Destroyed:</span> <strong>{totalDestroyed.toLocaleString()}</strong></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving ? 'Posting…' : 'Post Return GRN'}
        </Button>
      </div>
    </form>
  );
}
