'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle, XCircle, RefreshCw, Ban } from 'lucide-react';

export function QuotationActions({ quotationId, status }: { quotationId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const doAction = async (action: string, extra: object = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/quotations/${quotationId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Action failed'); }
      const data = await res.json();
      if (action === 'revise' && data.id) {
        toast.success(`New revision ${data.quotationNo} created`);
        router.push(`/sales/quotations/${data.id}`);
        return;
      }
      toast.success(`Quotation ${action === 'send' ? 'sent' : action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : action}`);
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setRejectMode(false); }
  };

  const terminal = ['accepted', 'rejected', 'cancelled'].includes(status);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>}

        {!loading && (
          <>
            {terminal ? (
              <p className="text-xs text-slate-400 capitalize">Quotation is {status}.</p>
            ) : rejectMode ? (
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">Rejection Reason</label>
                <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Price too high" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejectMode(false)}>Cancel</Button>
                  <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => doAction('reject', { reason: rejectionReason })}>
                    Confirm Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {status === 'draft' && (
                  <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => doAction('send')}>
                    <Send className="mr-1.5 h-3.5 w-3.5" />Mark as Sent
                  </Button>
                )}
                {status === 'sent' && (
                  <>
                    <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => doAction('accept')}>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Customer Accepted
                    </Button>
                    <Button size="sm" variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectMode(true)}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />Customer Rejected
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => doAction('revise')}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Create Revision
                    </Button>
                  </>
                )}
                {(status === 'draft' || status === 'sent') && (
                  <Button size="sm" variant="outline" className="w-full text-slate-500" onClick={() => doAction('cancel')}>
                    <Ban className="mr-1.5 h-3.5 w-3.5" />Cancel
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
