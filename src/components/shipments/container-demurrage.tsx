'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertTriangle, Package, Plus } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface Container {
  id: string;
  containerNo: string;
  sealNo: string | null;
  containerType: string | null;
  portFreeDays: number | null;
  detentionFreeDays: number | null;
  demurrageRatePerDay: string | null;
  demurrageCurrency: string | null;
  portArrivalDate: string | null;
  portClearanceDate: string | null;
  emptyReturnDate: string | null;
  demurrageInvoiceNo: string | null;
  demurragePaidAmount: string | null;
}

interface Props { shipmentId: string; containers: Container[]; ata: string | null }

function calcDemurrage(c: Container, ata: string | null) {
  const arrivalDate = c.portArrivalDate ? new Date(c.portArrivalDate) : (ata ? new Date(ata) : null);
  if (!arrivalDate) return null;
  const clearDate = c.portClearanceDate ? new Date(c.portClearanceDate) : new Date();
  const totalDays = differenceInDays(clearDate, arrivalDate);
  const freeDays = c.portFreeDays ?? 7;
  const billableDays = Math.max(0, totalDays - freeDays);
  const ratePerDay = Number(c.demurrageRatePerDay ?? 0);
  const estimatedCost = billableDays * ratePerDay;
  const daysUntilStart = Math.max(0, freeDays - totalDays);
  return { totalDays, freeDays, billableDays, estimatedCost, daysUntilStart, ratePerDay };
}

export function ContainerDemurrage({ shipmentId, containers: initial, ata }: Props) {
  const router = useRouter();
  const [containers, setContainers] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newContainer, setNewContainer] = useState({ containerNo: '', sealNo: '', containerType: '20GP', portFreeDays: '7', demurrageRatePerDay: '', demurrageCurrency: 'USD' });

  const startEdit = (c: Container) => {
    setEditing(c.id);
    setEditForm({
      portArrivalDate: c.portArrivalDate ?? '',
      portClearanceDate: c.portClearanceDate ?? '',
      emptyReturnDate: c.emptyReturnDate ?? '',
      demurrageRatePerDay: c.demurrageRatePerDay ?? '',
      portFreeDays: String(c.portFreeDays ?? 7),
      demurrageInvoiceNo: c.demurrageInvoiceNo ?? '',
      demurragePaidAmount: c.demurragePaidAmount ?? '',
    });
  };

  const saveEdit = async (containerId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/containers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerId,
          portArrivalDate: editForm.portArrivalDate || null,
          portClearanceDate: editForm.portClearanceDate || null,
          emptyReturnDate: editForm.emptyReturnDate || null,
          demurrageRatePerDay: editForm.demurrageRatePerDay ? Number(editForm.demurrageRatePerDay) : null,
          portFreeDays: Number(editForm.portFreeDays) || 7,
          demurrageInvoiceNo: editForm.demurrageInvoiceNo || null,
          demurragePaidAmount: editForm.demurragePaidAmount ? Number(editForm.demurragePaidAmount) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setContainers((prev) => prev.map((c) => (c.id === containerId ? { ...c, ...updated } : c)));
      setEditing(null);
      router.refresh();
    } catch {
      toast.error('Failed to update container');
    } finally {
      setLoading(false);
    }
  };

  const addContainer = async () => {
    if (!newContainer.containerNo.trim()) { toast.error('Container number required'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/containers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newContainer,
          portFreeDays: Number(newContainer.portFreeDays) || 7,
          demurrageRatePerDay: newContainer.demurrageRatePerDay ? Number(newContainer.demurrageRatePerDay) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setContainers((prev) => [...prev, created]);
      setAddingNew(false);
      setNewContainer({ containerNo: '', sealNo: '', containerType: '20GP', portFreeDays: '7', demurrageRatePerDay: '', demurrageCurrency: 'USD' });
      router.refresh();
    } catch {
      toast.error('Failed to add container');
    } finally {
      setLoading(false);
    }
  };

  const totalEstimated = containers.reduce((sum, c) => {
    const d = calcDemurrage(c, ata);
    return sum + (d?.estimatedCost ?? 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Containers & Demurrage ({containers.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            {totalEstimated > 0 && (
              <span className="text-xs text-red-600 font-semibold">Est. demurrage: ${totalEstimated.toFixed(0)}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => setAddingNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {addingNew && (
          <div className="p-4 border-b bg-slate-50 grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Container No <span className="text-red-500">*</span></Label>
              <Input className="font-mono text-xs" placeholder="ABCU1234567"
                value={newContainer.containerNo}
                onChange={(e) => setNewContainer((p) => ({ ...p, containerNo: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                value={newContainer.containerType}
                onChange={(e) => setNewContainer((p) => ({ ...p, containerType: e.target.value }))}>
                {['20GP', '40GP', '40HC', 'LCL', 'Break Bulk'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port Free Days</Label>
              <Input type="number" className="text-xs" value={newContainer.portFreeDays}
                onChange={(e) => setNewContainer((p) => ({ ...p, portFreeDays: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Demurrage Rate / Day</Label>
              <div className="flex gap-1">
                <select className="w-16 border rounded-md px-1 py-1.5 text-xs bg-white"
                  value={newContainer.demurrageCurrency}
                  onChange={(e) => setNewContainer((p) => ({ ...p, demurrageCurrency: e.target.value }))}>
                  <option>USD</option><option>PKR</option>
                </select>
                <Input type="number" step="0.01" className="flex-1 text-xs" placeholder="0"
                  value={newContainer.demurrageRatePerDay}
                  onChange={(e) => setNewContainer((p) => ({ ...p, demurrageRatePerDay: e.target.value }))} />
              </div>
            </div>
            <div className="col-span-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddingNew(false)}>Cancel</Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={addContainer} disabled={loading}>Save</Button>
            </div>
          </div>
        )}

        {containers.length === 0 && !addingNew ? (
          <p className="text-sm text-slate-400 text-center py-8">No containers added yet</p>
        ) : (
          <div className="divide-y">
            {containers.map((c) => {
              const d = calcDemurrage(c, ata);
              const atRisk = d && d.billableDays > 0;
              const soonExpiring = d && d.daysUntilStart <= 3 && d.daysUntilStart > 0;

              return (
                <div key={c.id} className={`p-4 ${atRisk ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {atRisk && <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                      <div>
                        <p className="font-mono font-bold text-slate-900">{c.containerNo}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>{c.containerType}</span>
                          {c.sealNo && <span>Seal: {c.sealNo}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Demurrage meter */}
                    {d && (
                      <div className="text-right text-xs">
                        {atRisk ? (
                          <>
                            <p className="text-red-600 font-bold text-base">${d.estimatedCost.toFixed(0)}</p>
                            <p className="text-red-500">{d.billableDays}d × ${d.ratePerDay}/d</p>
                            {c.demurragePaidAmount && (
                              <p className="text-green-600 mt-1">Paid: ${Number(c.demurragePaidAmount).toFixed(0)}</p>
                            )}
                          </>
                        ) : soonExpiring ? (
                          <>
                            <p className="text-amber-600 font-bold">{d.daysUntilStart}d until demurrage</p>
                            <p className="text-amber-500">Free until day {d.freeDays}</p>
                          </>
                        ) : (
                          <p className="text-green-600">Within free period ({d.totalDays}/{d.freeDays}d)</p>
                        )}
                      </div>
                    )}

                    <Button variant="outline" size="sm" className="text-xs" onClick={() => editing === c.id ? setEditing(null) : startEdit(c)}>
                      {editing === c.id ? 'Cancel' : 'Update'}
                    </Button>
                  </div>

                  {editing === c.id && (
                    <div className="mt-3 p-3 bg-white border rounded-lg grid grid-cols-3 gap-3">
                      {[
                        { k: 'portArrivalDate', label: 'Port Arrival Date', type: 'date' },
                        { k: 'portClearanceDate', label: 'Port Clearance Date', type: 'date' },
                        { k: 'emptyReturnDate', label: 'Empty Return Date', type: 'date' },
                        { k: 'portFreeDays', label: 'Free Days', type: 'number' },
                        { k: 'demurrageRatePerDay', label: 'Rate / Day (USD)', type: 'number' },
                        { k: 'demurrageInvoiceNo', label: 'Invoice No.', type: 'text' },
                        { k: 'demurragePaidAmount', label: 'Amount Paid', type: 'number' },
                      ].map(({ k, label, type }) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input type={type} className="text-xs" value={editForm[k] ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))} />
                        </div>
                      ))}
                      <div className="col-span-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => saveEdit(c.id)} disabled={loading}>Save</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
