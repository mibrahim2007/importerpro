'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Send, CheckCircle2, Ban, Loader2 } from 'lucide-react';

interface Props {
  rfqId: string;
  status: string;
  canApprove: boolean;
}

export function RfqStatusActions({ rfqId, status, canApprove }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const patch = async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      router.refresh();
      toast.success('RFQ updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status === 'draft' && (
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => patch('send')} disabled={!!loading}>
          {loading === 'send' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Send to Suppliers
        </Button>
      )}
      {status === 'quotes_received' && canApprove && (
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => patch('mark_comparison_done')} disabled={!!loading}>
          {loading === 'mark_comparison_done' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Mark Comparison Done
        </Button>
      )}
      {!['cancelled', 'po_created'].includes(status) && (
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
          onClick={() => { if (confirm('Cancel this RFQ?')) patch('cancel'); }}
          disabled={!!loading}>
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  );
}
