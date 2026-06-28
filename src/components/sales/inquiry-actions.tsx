'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const LOSS_REASONS = ['price', 'availability', 'quality', 'competitor', 'other'];

export function InquiryActions({ inquiryId, status }: { inquiryId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [lossReason, setLossReason] = useState('');

  const doAction = async (action: string, extra: object = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/inquiries/${inquiryId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? 'Action failed');
      }
      toast.success(`Inquiry marked as ${action}`);
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setShowLost(false); }
  };

  if (['won', 'cancelled'].includes(status)) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>}

        {!loading && (
          <>
            {status === 'lost' ? (
              <p className="text-xs text-slate-400">Inquiry is closed (Lost).</p>
            ) : showLost ? (
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">Loss Reason</label>
                <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm capitalize">
                  <option value="">Select reason…</option>
                  {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowLost(false)}>Cancel</Button>
                  <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => doAction('lost', { lossReason })}>Confirm Lost</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button size="sm" variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowLost(true)}>
                  Mark as Lost
                </Button>
                {status !== 'cancelled' && (
                  <Button size="sm" variant="outline" className="w-full text-slate-500" onClick={() => doAction('cancelled')}>
                    Cancel Inquiry
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
