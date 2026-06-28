'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Ship, Anchor, Package, Ban, Loader2 } from 'lucide-react';

interface Props {
  poId: string;
  status: string;
  canManage: boolean;
}

const ACTIONS: Record<string, { label: string; action: string; icon: any; className: string; allowedStatus: string[] }[]> = {
  confirmed: [
    { label: 'Request LC', action: 'request_lc', icon: Anchor, className: 'bg-indigo-600 hover:bg-indigo-700', allowedStatus: ['confirmed'] },
  ],
  lc_requested: [
    { label: 'Mark LC Opened', action: 'lc_opened', icon: CheckCircle2, className: 'bg-violet-600 hover:bg-violet-700', allowedStatus: ['lc_requested'] },
  ],
  lc_opened: [
    { label: 'Mark Goods Dispatched', action: 'goods_dispatched', icon: Ship, className: 'bg-amber-600 hover:bg-amber-700', allowedStatus: ['lc_opened'] },
  ],
  goods_dispatched: [
    { label: 'Mark Received', action: 'mark_received', icon: Package, className: 'bg-green-600 hover:bg-green-700', allowedStatus: ['goods_dispatched'] },
  ],
  partially_received: [
    { label: 'Mark Fully Received', action: 'mark_received', icon: Package, className: 'bg-green-600 hover:bg-green-700', allowedStatus: ['partially_received'] },
  ],
};

export function PoStatusActions({ poId, status, canManage }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const patch = async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      router.refresh();
      toast.success('PO updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  const primaryActions = ACTIONS[status] ?? [];

  const canCancel = ['draft', 'confirmed'].includes(status);

  if (!canManage && !canCancel) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {status === 'draft' && canManage && (
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => patch('confirm')} disabled={!!loading}>
          {loading === 'confirm' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Confirm PO
        </Button>
      )}

      {canManage && primaryActions.map((a) => (
        <Button key={a.action} size="sm" className={a.className} onClick={() => patch(a.action)} disabled={!!loading}>
          {loading === a.action ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <a.icon className="mr-1.5 h-4 w-4" />}
          {a.label}
        </Button>
      ))}

      {canCancel && (
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
          onClick={() => { if (confirm('Cancel this PO?')) patch('cancel'); }}
          disabled={!!loading}>
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  );
}
