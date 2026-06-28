'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Truck, CheckCircle2, Ban } from 'lucide-react';

interface Props { transferId: string; status: string; canManage: boolean }

export function TransferStatusActions({ transferId, status, canManage }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const patch = async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/stock/transfers/${transferId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      router.refresh();
      toast.success('Transfer updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2 justify-end flex-wrap">
      {status === 'draft' && (
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
          onClick={() => patch('validate')} disabled={!!loading}>
          {loading === 'validate' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Truck className="mr-1.5 h-4 w-4" />}
          Dispatch (In Transit)
        </Button>
      )}
      {status === 'validated' && (
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700"
          onClick={() => patch('complete')} disabled={!!loading}>
          {loading === 'complete' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Confirm Receipt — Complete Transfer
        </Button>
      )}
      {status === 'done' && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-700 font-medium">Transfer complete — stock moved</span>
        </div>
      )}
      {['draft', 'validated'].includes(status) && (
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
          onClick={() => { if (confirm('Cancel this transfer?')) patch('cancel'); }} disabled={!!loading}>
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  );
}
