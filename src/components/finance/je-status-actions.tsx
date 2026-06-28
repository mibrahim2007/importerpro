'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Send, RefreshCw } from 'lucide-react';

interface Props { jeId: string; status: string }

export function JeStatusActions({ jeId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const patch = async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/finance/journal/${jeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      router.refresh();
      toast.success(action === 'post' ? 'Entry posted to ledger' : 'Entry reversed');
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(null); }
  };

  return (
    <div className="flex items-center gap-2 justify-end">
      {status === 'draft' && (
        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => patch('post')} disabled={!!loading}>
          {loading === 'post' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Post to Ledger
        </Button>
      )}
      {status === 'posted' && (
        <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50"
          onClick={() => { if (confirm('Create a reversal entry?')) patch('reverse'); }} disabled={!!loading}>
          {loading === 'reverse' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Reverse
        </Button>
      )}
    </div>
  );
}
