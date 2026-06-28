'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Send, Ban, Loader2 } from 'lucide-react';

interface Props {
  indentId: string;
  status: string;
  canSubmit: boolean;
  canApproveOrReject: boolean;
  canCancel: boolean;
}

export function IndentActions({ indentId, status, canSubmit, canApproveOrReject, canCancel }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  const patch = async (action: string, body?: object) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/indents/${indentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Request failed');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleApprove = () => patch('approve');
  const handleSubmit = () => patch('submit');
  const handleCancel = () => {
    if (!confirm('Cancel this indent? This cannot be undone.')) return;
    patch('cancel');
  };
  const handleReject = async () => {
    if (!reason.trim()) { toast.error('Please enter a rejection reason'); return; }
    await patch('reject', { reason });
    setRejectMode(false);
    setReason('');
  };

  if (!canSubmit && !canApproveOrReject && !canCancel) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {canSubmit && (
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700"
          onClick={handleSubmit}
          disabled={loading === 'submit'}
        >
          {loading === 'submit' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Submit for Approval
        </Button>
      )}

      {canApproveOrReject && !rejectMode && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setRejectMode(true)}
          >
            <XCircle className="mr-1.5 h-4 w-4" /> Reject
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleApprove}
            disabled={loading === 'approve'}
          >
            {loading === 'approve' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
            Approve
          </Button>
        </>
      )}

      {rejectMode && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="Rejection reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReject()}
          />
          <Button variant="ghost" size="sm" onClick={() => { setRejectMode(false); setReason(''); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleReject}
            disabled={loading === 'reject'}
          >
            {loading === 'reject' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Confirm Reject
          </Button>
        </div>
      )}

      {canCancel && status !== 'cancelled' && (
        <Button
          size="sm"
          variant="ghost"
          className="text-slate-500 hover:text-slate-700"
          onClick={handleCancel}
          disabled={loading === 'cancel'}
        >
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  );
}
