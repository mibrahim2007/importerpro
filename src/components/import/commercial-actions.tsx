'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';

export function CommercialActions({ ciId, status }: { ciId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const doAction = async (action: string) => {
    setLoading(action);
    try {
      await fetch(`/api/import/commercial/${ciId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally { setLoading(null); }
  };

  if (['cancelled'].includes(status)) return null;

  return (
    <div className="bg-white border rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</p>

      {status === 'received' && (
        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-sm" onClick={() => doAction('verify')} disabled={!!loading}>
          {loading === 'verify' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
          Verify CI Documents
        </Button>
      )}
      {['received', 'verified'].includes(status) && (
        <Button className="w-full bg-green-600 hover:bg-green-700 text-sm" onClick={() => doAction('mark_matched')} disabled={!!loading}>
          {loading === 'mark_matched' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <CheckCircle className="h-3.5 w-3.5 mr-2" />}
          Mark as Matched
        </Button>
      )}
      {['received', 'verified'].includes(status) && (
        <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 text-sm" onClick={() => doAction('mark_discrepant')} disabled={!!loading}>
          {loading === 'mark_discrepant' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
          Confirm Discrepancy
        </Button>
      )}
      {!['matched', 'discrepant'].includes(status) && (
        <Button variant="outline" className="w-full text-slate-500 border-slate-200 hover:bg-slate-50 text-sm" onClick={() => doAction('cancel')} disabled={!!loading}>
          {loading === 'cancel' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <XCircle className="h-3.5 w-3.5 mr-2" />}
          Cancel
        </Button>
      )}
    </div>
  );
}
