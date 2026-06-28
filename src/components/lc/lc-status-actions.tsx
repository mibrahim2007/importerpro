'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Send, FileCheck, Search, CheckCircle2, Archive, Ban } from 'lucide-react';

interface Props { lcId: string; status: string; canManage: boolean }

export function LcStatusActions({ lcId, status, canManage }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [swiftInput, setSwiftInput] = useState('');
  const [showSwift, setShowSwift] = useState(false);
  const [scrutinyStatus, setScrutinyStatus] = useState<'clean' | 'discrepant'>('clean');

  const patch = async (action: string, extra?: object) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/lc/${lcId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      router.refresh();
      toast.success('LC updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
      setShowSwift(false);
    }
  };

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {status === 'draft' && (
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
          onClick={() => patch('apply')} disabled={!!loading}>
          {loading === 'apply' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Submit Application
        </Button>
      )}

      {status === 'applied' && (
        <>
          {!showSwift ? (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setShowSwift(true)} disabled={!!loading}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark LC Opened
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input className="w-48 text-sm" placeholder="MT700 SWIFT ref (optional)"
                value={swiftInput} onChange={(e) => setSwiftInput(e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setShowSwift(false)}>Cancel</Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => patch('open', { swiftRef: swiftInput || undefined, openingDate: new Date().toISOString().split('T')[0] })}
                disabled={loading === 'open'}>
                {loading === 'open' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Confirm
              </Button>
            </div>
          )}
        </>
      )}

      {status === 'opened' && (
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700"
          onClick={() => patch('present_documents', { documentsReceivedDate: new Date().toISOString().split('T')[0] })}
          disabled={!!loading}>
          {loading === 'present_documents' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileCheck className="mr-1.5 h-4 w-4" />}
          Documents Presented
        </Button>
      )}

      {status === 'documents_presented' && (
        <div className="flex items-center gap-2">
          <select
            className="border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none"
            value={scrutinyStatus}
            onChange={(e) => setScrutinyStatus(e.target.value as any)}>
            <option value="clean">Clean — No discrepancies</option>
            <option value="discrepant">Discrepant — Issues found</option>
          </select>
          <Button size="sm" className="bg-orange-600 hover:bg-orange-700"
            onClick={() => patch('under_scrutiny', { scrutinyStatus })}
            disabled={!!loading}>
            {loading === 'under_scrutiny' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
            Start Scrutiny
          </Button>
        </div>
      )}

      {status === 'under_scrutiny' && (
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700"
          onClick={() => patch('accept')} disabled={!!loading}>
          {loading === 'accept' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Accept Documents
        </Button>
      )}

      {(status === 'accepted' || status === 'opened') && (
        <Button size="sm" className="bg-green-600 hover:bg-green-700"
          onClick={() => patch('retire')} disabled={!!loading}>
          {loading === 'retire' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Archive className="mr-1.5 h-4 w-4" />}
          Retire LC
        </Button>
      )}

      {['draft', 'applied'].includes(status) && (
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
          onClick={() => { if (confirm('Cancel this LC?')) patch('cancel'); }}
          disabled={!!loading}>
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  );
}
