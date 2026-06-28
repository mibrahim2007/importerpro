'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Send, Ban } from 'lucide-react';

interface Props { billId: string; status: string }

export function BillStatusActions({ billId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const patch = async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/finance/bills/${billId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      router.refresh();
      toast.success(`Bill ${action === 'post' ? 'posted' : 'cancelled'}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(null); }
  };

  return (
    <div className="flex items-center gap-2 justify-end">
      {status === 'draft' && (
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => patch('post')} disabled={!!loading}>
          {loading === 'post' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Post Bill
        </Button>
      )}
      {['draft', 'posted'].includes(status) && (
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
          onClick={() => { if (confirm('Cancel this bill?')) patch('cancel'); }} disabled={!!loading}>
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  );
}
