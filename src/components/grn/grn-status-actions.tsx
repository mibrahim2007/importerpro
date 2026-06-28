'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, PackageCheck, FlaskConical, CheckCircle2, Ban } from 'lucide-react';

interface Line { id: string; qualityStatus: string; productName: string; receivedQty: string; uom: string | null }
interface Props { grnId: string; status: string; canManage: boolean; qcLines: Line[] }

export function GrnStatusActions({ grnId, status, canManage, qcLines }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showQcPanel, setShowQcPanel] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, 'accepted' | 'rejected'>>({});

  const patch = async (action: string, extra?: object) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/grn/${grnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      router.refresh();
      toast.success('GRN updated');
      setShowQcPanel(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  if (!canManage) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {status === 'draft' && (
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700"
            onClick={() => patch('post')} disabled={!!loading}>
            {loading === 'post' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-1.5 h-4 w-4" />}
            Post GRN & Update Stock
          </Button>
        )}

        {status === 'qc_hold' && (
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700"
            onClick={() => setShowQcPanel(true)} disabled={!!loading}>
            <FlaskConical className="mr-1.5 h-4 w-4" /> Release from QC
          </Button>
        )}

        {['posted', 'qc_released'].includes(status) && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700 font-medium">Stock updated</span>
          </div>
        )}

        {status === 'draft' && (
          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
            onClick={() => { if (confirm('Cancel this GRN?')) patch('cancel'); }} disabled={!!loading}>
            <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>

      {/* QC Release Panel */}
      {showQcPanel && qcLines.length > 0 && (
        <div className="p-4 border rounded-lg bg-amber-50 border-amber-200 space-y-3">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> QC Decision — {qcLines.length} line{qcLines.length > 1 ? 's' : ''} under QC
          </p>
          <div className="space-y-2">
            {qcLines.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-white rounded border text-sm">
                <div>
                  <p className="font-medium text-slate-800">{l.productName}</p>
                  <p className="text-xs text-slate-400">{l.receivedQty} {l.uom ?? ''}</p>
                </div>
                <div className="flex gap-2">
                  {(['accepted', 'rejected'] as const).map((d) => (
                    <button key={d}
                      onClick={() => setDecisions((prev) => ({ ...prev, [l.id]: d }))}
                      className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors capitalize ${
                        decisions[l.id] === d
                          ? d === 'accepted' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowQcPanel(false)}>Cancel</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700"
              disabled={!!loading || qcLines.some((l) => !decisions[l.id])}
              onClick={() => patch('qc_release', { lineDecisions: decisions })}>
              {loading === 'qc_release' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Confirm QC Release
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
