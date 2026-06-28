'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, XCircle, Clock } from 'lucide-react';

const STEPS = [
  { key: 'draft', label: 'Draft Created' },
  { key: 'submitted', label: 'Submitted for Approval' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rfq_created', label: 'RFQ Created' },
  { key: 'po_confirmed', label: 'PO Confirmed' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  submitted: 1,
  under_review: 2,
  approved: 3,
  rfq_created: 4,
  po_confirmed: 5,
  closed: 6,
  rejected: -1,
  cancelled: -1,
};

interface Props {
  status: string;
  createdAt: string | null;
  approvedAt: string | null;
  approver: { name?: string | null; email?: string | null } | null;
  rejectedReason: string | null;
}

export function IndentTimeline({ status, createdAt, approvedAt, approver, rejectedReason }: Props) {
  const currentOrder = STATUS_ORDER[status] ?? 0;
  const isTerminated = status === 'rejected' || status === 'cancelled';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {STEPS.map((step, i) => {
          const stepOrder = STATUS_ORDER[step.key] ?? i;
          const isDone = stepOrder < currentOrder || status === step.key;
          const isCurrent = status === step.key;
          const isFuture = stepOrder > currentOrder;
          const isLast = i === STEPS.length - 1;

          return (
            <div key={step.key} className="flex gap-3">
              {/* Line + icon */}
              <div className="flex flex-col items-center">
                <div className={`rounded-full p-0.5 ${isDone ? 'text-teal-600' : isCurrent ? 'text-teal-600' : 'text-slate-300'}`}>
                  {isDone && !isCurrent ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isCurrent ? (
                    <CheckCircle2 className="h-5 w-5 text-teal-600" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                {!isLast && (
                  <div className={`w-px flex-1 my-0.5 ${stepOrder < currentOrder ? 'bg-teal-300' : 'bg-slate-200'}`} style={{ minHeight: 16 }} />
                )}
              </div>

              {/* Label */}
              <div className={`pb-4 pt-0.5 text-sm ${isDone || isCurrent ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                {step.label}
                {step.key === 'approved' && isCurrent && approvedAt && (
                  <p className="text-xs font-normal text-slate-400 mt-0.5">
                    {new Date(approvedAt).toLocaleDateString('en-PK')}
                    {approver ? ` · by ${approver.name ?? approver.email}` : ''}
                  </p>
                )}
                {step.key === 'draft' && isCurrent && createdAt && (
                  <p className="text-xs font-normal text-slate-400 mt-0.5">
                    {new Date(createdAt).toLocaleDateString('en-PK')}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Rejected / Cancelled terminal state */}
        {isTerminated && (
          <div className="flex gap-3 mt-1">
            <XCircle className={`h-5 w-5 shrink-0 ${status === 'rejected' ? 'text-red-500' : 'text-slate-400'}`} />
            <div className="pt-0.5">
              <p className={`text-sm font-medium capitalize ${status === 'rejected' ? 'text-red-600' : 'text-slate-500'}`}>
                {status}
              </p>
              {status === 'rejected' && rejectedReason && (
                <p className="text-xs text-red-400 mt-0.5">{rejectedReason}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
