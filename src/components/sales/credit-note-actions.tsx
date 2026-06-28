'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Cn {
  id: string;
  status: string | null;
  invoiceNo?: string;
}

export function CreditNoteActions({ cn }: { cn: Cn }) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const status = cn.status ?? 'draft';

  async function doAction(action: string, extra?: Record<string, string>) {
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/sales/credit-notes/${cn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Action failed');
      }
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

  if (status === 'cancelled') return null;

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {status === 'draft' && (
        <Button
          onClick={() => doAction('post')}
          disabled={!!loading}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {loading === 'post' ? 'Posting…' : 'Post Credit Note'}
        </Button>
      )}

      {status !== 'cancelled' && (
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={!!loading}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          {loading === 'cancel' ? 'Cancelling…' : 'Cancel CN'}
        </Button>
      )}
    </div>
  );
}
