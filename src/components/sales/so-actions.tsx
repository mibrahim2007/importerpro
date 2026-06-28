'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, ShieldCheck, Ban } from 'lucide-react';

interface Props {
  soId: string;
  status: string;
  creditCheck: string | null;
}

export function SoActions({ soId, status, creditCheck }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'idle' | 'cancel' | 'credit_override'>('idle');
  const [reason, setReason] = useState('');
  const [approvalNote, setApprovalNote] = useState('');

  const doAction = async (action: string, extra: object = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/orders/${soId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');

      if (action === 'confirm' && data.creditHold) {
        toast.warning('Order placed on credit hold — awaiting Finance approval');
      } else {
        toast.success(
          action === 'confirm' ? 'Order confirmed & stock reserved' :
          action === 'approve_credit' ? 'Credit approved — order confirmed' :
          action === 'cancel' ? 'Order cancelled' : 'Done'
        );
      }
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setMode('idle'); }
  };

  const terminal = ['invoiced', 'closed', 'cancelled', 'fully_dispatched'].includes(status);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>}

        {!loading && (
          <>
            {terminal ? (
              <p className="text-xs text-slate-400 capitalize">Order is {status}.</p>
            ) : mode === 'cancel' ? (
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">Cancellation Reason</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  rows={2} placeholder="e.g. Customer withdrew order"
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Back</Button>
                  <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => doAction('cancel', { reason })}>
                    Confirm Cancel
                  </Button>
                </div>
              </div>
            ) : mode === 'credit_override' ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 font-medium">Approve credit override</p>
                <label className="block text-xs text-slate-500">Approval Note (reason for override)</label>
                <textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)}
                  rows={2} placeholder="e.g. Customer has good payment history"
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Back</Button>
                  <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={() => doAction('approve_credit', { approvalNote })}>
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />Approve & Confirm
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {status === 'draft' && (
                  <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => doAction('confirm')}>
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Confirm Order
                  </Button>
                )}
                {status === 'pending_approval' && (
                  <>
                    <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => setMode('credit_override')}>
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Approve Credit Override
                    </Button>
                    <p className="text-xs text-center text-slate-400">Finance Officer action</p>
                  </>
                )}
                {['draft', 'pending_approval', 'confirmed', 'partially_dispatched'].includes(status) && (
                  <Button size="sm" variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => setMode('cancel')}>
                    <Ban className="mr-1.5 h-3.5 w-3.5" />Cancel Order
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
