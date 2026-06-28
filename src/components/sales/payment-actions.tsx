'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Props { receiptId: string; status: string }

export function PaymentActions({ receiptId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'idle' | 'bounce' | 'cancel'>('idle');
  const [reason, setReason] = useState('');

  const doAction = async (action: string, extra: object = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/payments/${receiptId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      const msgs: Record<string, string> = {
        clear_pdc: 'PDC cleared — invoice balances updated',
        bounce: 'Cheque marked as bounced',
        cancel: 'Receipt cancelled — invoice balances reversed',
      };
      toast.success(msgs[action] ?? 'Done');
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setMode('idle'); setReason(''); }
  };

  const isTerminal = ['bounced', 'cancelled'].includes(status);
  if (isTerminal) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>}

        {!loading && mode === 'idle' && (
          <div className="space-y-2">
            {status === 'pending' && (
              <>
                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => doAction('clear_pdc')}>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Clear PDC — Apply to Invoices
                </Button>
                <Button size="sm" variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setMode('bounce')}>
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />Mark Cheque Bounced
                </Button>
              </>
            )}
            {status === 'cleared' && (
              <Button size="sm" variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setMode('cancel')}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />Cancel Receipt
              </Button>
            )}
          </div>
        )}

        {!loading && mode === 'bounce' && (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Bounce Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select reason…</option>
              <option value="Insufficient funds">Insufficient funds</option>
              <option value="Account closed">Account closed</option>
              <option value="Payment stopped">Payment stopped</option>
              <option value="Signature mismatch">Signature mismatch</option>
              <option value="Date error">Date error</option>
              <option value="Other">Other</option>
            </select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Back</Button>
              <Button size="sm" variant="destructive" className="flex-1" disabled={!reason}
                onClick={() => doAction('bounce', { reason })}>Confirm Bounce</Button>
            </div>
          </div>
        )}

        {!loading && mode === 'cancel' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">This will reverse all invoice allocations and restore previous balances.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Back</Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => doAction('cancel')}>
                Confirm Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
