'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2, Clock, FileText } from 'lucide-react';

interface Props {
  shipmentId: string;
  blReceivedAtBank: boolean;
  blReceivedDate: string | null;
  docsReleasedByBank: boolean;
  docsReleasedDate: string | null;
  docsSentToAgent: boolean;
  docsSentDate: string | null;
  courierTrackingNo: string | null;
}

export function DocumentArrivalTracker(props: Props) {
  const router = useRouter();
  const [state, setState] = useState({
    blReceivedAtBank: props.blReceivedAtBank,
    blReceivedDate: props.blReceivedDate ?? '',
    docsReleasedByBank: props.docsReleasedByBank,
    docsReleasedDate: props.docsReleasedDate ?? '',
    docsSentToAgent: props.docsSentToAgent,
    docsSentDate: props.docsSentDate ?? '',
    courierTrackingNo: props.courierTrackingNo ?? '',
  });
  const [loading, setLoading] = useState(false);

  const patch = async (payload: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shipments/${props.shipmentId}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setState((s) => ({
        ...s,
        blReceivedAtBank: updated.blReceivedAtBank ?? s.blReceivedAtBank,
        blReceivedDate: updated.blReceivedDate ?? s.blReceivedDate,
        docsReleasedByBank: updated.docsReleasedByBank ?? s.docsReleasedByBank,
        docsReleasedDate: updated.docsReleasedDate ?? s.docsReleasedDate,
        docsSentToAgent: updated.docsSentToAgent ?? s.docsSentToAgent,
        docsSentDate: updated.docsSentDate ?? s.docsSentDate,
        courierTrackingNo: updated.courierTrackingNo ?? s.courierTrackingNo,
      }));
      router.refresh();
    } catch {
      toast.error('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      key: 'blReceivedAtBank',
      label: 'Original B/L Received at Bank',
      subLabel: 'Shipping documents received by negotiating bank',
      done: state.blReceivedAtBank,
      date: state.blReceivedDate,
      onToggle: () => patch({ blReceivedAtBank: !state.blReceivedAtBank }),
    },
    {
      key: 'docsReleasedByBank',
      label: 'Documents Released by Bank',
      subLabel: 'Bank has endorsed and released documents to importer',
      done: state.docsReleasedByBank,
      date: state.docsReleasedDate,
      onToggle: () => patch({ docsReleasedByBank: !state.docsReleasedByBank }),
    },
    {
      key: 'docsSentToAgent',
      label: 'Documents Sent to Clearing Agent',
      subLabel: 'Original documents dispatched to customs/clearing agent',
      done: state.docsSentToAgent,
      date: state.docsSentDate,
      onToggle: () => patch({ docsSentToAgent: !state.docsSentToAgent }),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Document Arrival Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.key} className={`flex items-start gap-3 p-3 rounded-lg border ${step.done ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
              <button onClick={step.onToggle} disabled={loading} className="mt-0.5 shrink-0">
                {step.done
                  ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                  : <Clock className="h-5 w-5 text-slate-300" />}
              </button>
              <div className="flex-1">
                <p className={`text-sm font-medium ${step.done ? 'text-green-800' : 'text-slate-700'}`}>{step.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{step.subLabel}</p>
                {step.done && step.date && (
                  <p className="text-xs text-green-600 mt-1">{new Date(step.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Courier tracking */}
        <div className="space-y-1.5">
          <Label className="text-xs">Courier Tracking No (for docs sent to agent)</Label>
          <div className="flex gap-2">
            <Input className="text-xs" placeholder="e.g. TCS-123456789"
              value={state.courierTrackingNo}
              onChange={(e) => setState((s) => ({ ...s, courierTrackingNo: e.target.value }))} />
            <Button size="sm" variant="outline" disabled={loading}
              onClick={() => patch({ courierTrackingNo: state.courierTrackingNo })}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
