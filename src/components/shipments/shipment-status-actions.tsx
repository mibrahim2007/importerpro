'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Anchor, Navigation, PackageCheck, FileCheck, ClipboardCheck, Ban } from 'lucide-react';

interface Props { shipmentId: string; status: string; canManage: boolean }

export function ShipmentStatusActions({ shipmentId, status, canManage }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [doNoInput, setDoNoInput] = useState('');
  const [showDoInput, setShowDoInput] = useState(false);

  const patch = async (action: string, extra?: object) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      router.refresh();
      toast.success('Shipment updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
      setShowDoInput(false);
    }
  };

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {status === 'draft' && (
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => patch('book')} disabled={!!loading}>
          {loading === 'book' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Anchor className="mr-1.5 h-4 w-4" />}
          Mark Booked
        </Button>
      )}
      {status === 'booked' && (
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => patch('mark_sailing')} disabled={!!loading}>
          {loading === 'mark_sailing' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Navigation className="mr-1.5 h-4 w-4" />}
          Vessel Sailed
        </Button>
      )}
      {status === 'sailing' && (
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => patch('mark_arrived')} disabled={!!loading}>
          {loading === 'mark_arrived' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Anchor className="mr-1.5 h-4 w-4" />}
          Arrived at Port
        </Button>
      )}
      {status === 'arrived' && (
        <>
          {!showDoInput ? (
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => setShowDoInput(true)} disabled={!!loading}>
              <FileCheck className="mr-1.5 h-4 w-4" /> DO Released
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input className="w-44 text-sm" placeholder="Delivery Order No." value={doNoInput} onChange={(e) => setDoNoInput(e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setShowDoInput(false)}>Cancel</Button>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700"
                onClick={() => patch('release_do', { doNo: doNoInput || undefined })} disabled={loading === 'release_do'}>
                {loading === 'release_do' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Confirm
              </Button>
            </div>
          )}
        </>
      )}
      {status === 'do_released' && (
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => patch('customs_cleared')} disabled={!!loading}>
          {loading === 'customs_cleared' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-4 w-4" />}
          Customs Cleared
        </Button>
      )}
      {status === 'customs_cleared' && (
        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => patch('grn_done')} disabled={!!loading}>
          {loading === 'grn_done' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-1.5 h-4 w-4" />}
          GRN Complete
        </Button>
      )}
      {['draft', 'booked'].includes(status) && (
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
          onClick={() => { if (confirm('Cancel this shipment?')) patch('cancel'); }} disabled={!!loading}>
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  );
}
