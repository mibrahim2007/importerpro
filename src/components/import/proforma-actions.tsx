'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, RefreshCw, XCircle } from 'lucide-react';

export function ProformaActions({ piId, status }: { piId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const doAction = async (action: string) => {
    setLoading(action);
    try {
      await fetch(`/api/import/proforma/${piId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally { setLoading(null); }
  };

  if (['superseded', 'cancelled'].includes(status)) return null;

  return (
    <div className="bg-white border rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</p>
      {status === 'received' && (
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-sm"
          onClick={() => doAction('accept')}
          disabled={!!loading}
        >
          {loading === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <CheckCircle className="h-3.5 w-3.5 mr-2" />}
          Accept PI
        </Button>
      )}
      {['received', 'accepted'].includes(status) && (
        <Button
          variant="outline"
          className="w-full text-amber-600 border-amber-200 hover:bg-amber-50 text-sm"
          onClick={() => doAction('supersede')}
          disabled={!!loading}
        >
          {loading === 'supersede' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
          Mark as Superseded
        </Button>
      )}
      {['draft', 'received'].includes(status) && (
        <Button
          variant="outline"
          className="w-full text-red-600 border-red-200 hover:bg-red-50 text-sm"
          onClick={() => doAction('cancel')}
          disabled={!!loading}
        >
          {loading === 'cancel' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <XCircle className="h-3.5 w-3.5 mr-2" />}
          Cancel
        </Button>
      )}
    </div>
  );
}
