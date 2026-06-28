'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle, FileCheck, Truck, Package } from 'lucide-react';

interface Props { dcId: string; status: string; gatePassNo: string | null }

export function DcActions({ dcId, status, gatePassNo }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'idle' | 'gate_pass' | 'deliver'>('idle');
  const [gpNo, setGpNo] = useState(gatePassNo ?? '');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);

  const doAction = async (action: string, extra: object = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/dispatch/${dcId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      const messages: Record<string, string> = {
        approve: 'DC approved by Warehouse Manager',
        issue_gate_pass: `Gate pass ${data.gatePassNo} issued`,
        gate_out: 'Vehicle gate out recorded — shipment in transit',
        deliver: `Delivered · SO status: ${data.soStatus?.replace('_', ' ')}`,
      };
      toast.success(messages[action] ?? 'Done');
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setMode('idle'); }
  };

  if (status === 'delivered' || status === 'returned') return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>}

        {!loading && mode === 'idle' && (
          <div className="space-y-2">
            {status === 'draft' && (
              <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => doAction('approve')}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Approve (WH Manager)
              </Button>
            )}
            {status === 'approved' && (
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setMode('gate_pass')}>
                <FileCheck className="mr-1.5 h-3.5 w-3.5" />Issue Gate Pass
              </Button>
            )}
            {status === 'gate_pass_issued' && (
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => doAction('gate_out')}>
                <Truck className="mr-1.5 h-3.5 w-3.5" />Gate Out — Start Transit
              </Button>
            )}
            {status === 'in_transit' && (
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => setMode('deliver')}>
                <Package className="mr-1.5 h-3.5 w-3.5" />Mark as Delivered
              </Button>
            )}
          </div>
        )}

        {!loading && mode === 'gate_pass' && (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Gate Pass No</label>
            <input value={gpNo} onChange={(e) => setGpNo(e.target.value)}
              placeholder="Auto-generated if blank" className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => doAction('issue_gate_pass', { gatePassNo: gpNo })}>
                Issue
              </Button>
            </div>
          </div>
        )}

        {!loading && mode === 'deliver' && (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Delivery Confirmed Date</label>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => doAction('deliver', { deliveryConfirmedDate: deliveryDate })}>
                Confirm Delivery
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
