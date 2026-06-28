'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Pra {
  id: string;
  status: string | null;
  praNo?: string | null;
  debitNoteId?: string | null;
}

export function PurchaseReturnActions({ pra }: { pra: Pra }) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const status = pra.status ?? 'draft';

  async function doAction(action: string, extra?: Record<string, string>) {
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/purchase/returns/${pra.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Action failed'); }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  }

  function handleCancel() {
    const reason = window.prompt('Reason for cancellation (optional):');
    if (reason === null) return;
    doAction('cancel', { reason });
  }

  if (['closed', 'cancelled'].includes(status)) return null;

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {status === 'draft' && (
        <Button onClick={() => doAction('approve')} disabled={!!loading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading === 'approve' ? 'Approving…' : 'Approve PRA'}
        </Button>
      )}

      {status === 'approved' && (
        <a href={`/import/returns/${pra.id}/dispatch`}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">
          Dispatch Return Goods →
        </a>
      )}

      {status === 'goods_dispatched' && !pra.debitNoteId && (
        <a href={`/import/debit-notes/new?praId=${pra.id}`}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium">
          Issue Debit Note →
        </a>
      )}

      {!['cancelled', 'debit_issued', 'closed'].includes(status) && (
        <Button variant="outline" onClick={handleCancel} disabled={!!loading} className="border-red-200 text-red-600 hover:bg-red-50">
          {loading === 'cancel' ? 'Cancelling…' : 'Cancel PRA'}
        </Button>
      )}
    </div>
  );
}
