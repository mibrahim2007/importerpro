'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, FileCheck, Search, ClipboardCheck, CreditCard, CheckCircle2, Ban, AlertTriangle, MessageSquare } from 'lucide-react';

interface Props { gdId: string; status: string; canManage: boolean }

type Modal = null | 'file' | 'exam' | 'ao' | 'pay' | 'query' | 'reply';

export function GdStatusActions({ gdId, status, canManage }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const patch = async (action: string, extra?: object) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/customs/gd/${gdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed');
      router.refresh();
      toast.success('GD updated');
      setModal(null);
      setFields({});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  if (!canManage) return null;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* File GD */}
        {status === 'draft' && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setModal('file'); setFields({ gdDate: today }); }}>
            <FileCheck className="mr-1.5 h-4 w-4" /> File GD
          </Button>
        )}

        {/* Channel assignment */}
        {status === 'filed' && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => patch('assign_green')} disabled={!!loading}>
              {loading === 'assign_green' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Green Channel
            </Button>
            <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" onClick={() => patch('assign_yellow')} disabled={!!loading}>
              {loading === 'assign_yellow' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Yellow Channel
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => patch('assign_red')} disabled={!!loading}>
              {loading === 'assign_red' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Red Channel
            </Button>
          </>
        )}

        {/* Query */}
        {['filed', 'yellow_channel', 'red_channel'].includes(status) && (
          <Button size="sm" variant="outline" className="text-orange-600 border-orange-200" onClick={() => { setModal('query'); setFields({ queryRaisedDate: today }); }}>
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Raise Query
          </Button>
        )}
        {status === 'query_raised' && (
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setModal('reply'); setFields({ queryRepliedDate: today }); }}>
            <MessageSquare className="mr-1.5 h-4 w-4" /> Reply Query
          </Button>
        )}

        {/* Examination */}
        {status === 'red_channel' && (
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => { setModal('exam'); setFields({ examinationDate: today, examinationFindings: 'clear' }); }}>
            <Search className="mr-1.5 h-4 w-4" /> Record Examination
          </Button>
        )}

        {/* Assessment Order */}
        {['yellow_channel', 'examination_done', 'query_replied'].includes(status) && (
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { setModal('ao'); setFields({ aoDate: today }); }}>
            <ClipboardCheck className="mr-1.5 h-4 w-4" /> Issue AO
          </Button>
        )}

        {/* Pay Duty */}
        {['assessment_ordered', 'green_channel'].includes(status) && (
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => { setModal('pay'); setFields({ psidDate: today }); }}>
            <CreditCard className="mr-1.5 h-4 w-4" /> Record Duty Payment
          </Button>
        )}

        {/* Clear */}
        {status === 'duty_paid' && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => patch('clear', { gdClearedDate: today })} disabled={!!loading}>
            {loading === 'clear' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
            Mark Cleared
          </Button>
        )}

        {['draft', 'filed'].includes(status) && (
          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600"
            onClick={() => { if (confirm('Cancel this GD?')) patch('cancel'); }} disabled={!!loading}>
            <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>

      {/* Inline modal panels */}
      {modal === 'file' && (
        <div className="p-4 border rounded-lg bg-blue-50 border-blue-200 space-y-3">
          <p className="text-sm font-semibold text-blue-800">File GD on WeBOC</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">GD No (WeBOC)</Label>
              <Input className="text-xs" placeholder="KAPE-HC-2026-0012345" value={fields.gdNo ?? ''}
                onChange={(e) => set('gdNo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GD Date</Label>
              <Input type="date" className="text-xs" value={fields.gdDate ?? today}
                onChange={(e) => set('gdDate', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={!!loading}
              onClick={() => patch('file', { gdNo: fields.gdNo, gdDate: fields.gdDate })}>
              {loading === 'file' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Confirm Filing
            </Button>
          </div>
        </div>
      )}

      {modal === 'exam' && (
        <div className="p-4 border rounded-lg bg-purple-50 border-purple-200 space-y-3">
          <p className="text-sm font-semibold text-purple-800">Record Customs Examination</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Examination Date</Label>
              <Input type="date" className="text-xs" value={fields.examinationDate ?? today}
                onChange={(e) => set('examinationDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Findings</Label>
              <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-white"
                value={fields.examinationFindings ?? 'clear'}
                onChange={(e) => set('examinationFindings', e.target.value)}>
                {['clear', 'shortage', 'excess', 'mislabeled', 'quality_issue'].map((f) => (
                  <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Officer Name</Label>
              <Input className="text-xs" value={fields.examinationOfficer ?? ''}
                onChange={(e) => set('examinationOfficer', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location (Berth/Shed/CFS)</Label>
              <Input className="text-xs" value={fields.examinationLocation ?? ''}
                onChange={(e) => set('examinationLocation', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Exam Report No</Label>
              <Input className="text-xs" value={fields.examinationReportNo ?? ''}
                onChange={(e) => set('examinationReportNo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Examination Charges (PKR)</Label>
              <Input type="number" className="text-xs" value={fields.examinationChargesPkr ?? ''}
                onChange={(e) => set('examinationChargesPkr', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" disabled={!!loading}
              onClick={() => patch('examination_done', fields)}>
              {loading === 'examination_done' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Save Examination
            </Button>
          </div>
        </div>
      )}

      {modal === 'ao' && (
        <div className="p-4 border rounded-lg bg-indigo-50 border-indigo-200 space-y-3">
          <p className="text-sm font-semibold text-indigo-800">Assessment Order</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">AO No (WeBOC)</Label>
              <Input className="text-xs font-mono" value={fields.aoNo ?? ''}
                onChange={(e) => set('aoNo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">AO Date</Label>
              <Input type="date" className="text-xs" value={fields.aoDate ?? today}
                onChange={(e) => set('aoDate', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Final Payable (PKR) — if different from calculated</Label>
              <Input type="number" className="text-xs" placeholder="Leave blank to keep calculated amount"
                value={fields.totalPayablePkr ?? ''}
                onChange={(e) => set('totalPayablePkr', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={!!loading}
              onClick={() => patch('assessment_order', fields)}>
              {loading === 'assessment_order' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Issue AO
            </Button>
          </div>
        </div>
      )}

      {modal === 'pay' && (
        <div className="p-4 border rounded-lg bg-teal-50 border-teal-200 space-y-3">
          <p className="text-sm font-semibold text-teal-800">Record Duty Payment (PSID Challan)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">PSID No <span className="text-red-500">*</span></Label>
              <Input className="text-xs font-mono" placeholder="PSID-2026-XXXXXXXXX" value={fields.psidNo ?? ''}
                onChange={(e) => set('psidNo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Date</Label>
              <Input type="date" className="text-xs" value={fields.psidDate ?? today}
                onChange={(e) => set('psidDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bank</Label>
              <Input className="text-xs" placeholder="HBL / UBL / MCB / NBP…" value={fields.psidBankName ?? ''}
                onChange={(e) => set('psidBankName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount Paid (PKR)</Label>
              <Input type="number" className="text-xs" value={fields.psidAmountPkr ?? ''}
                onChange={(e) => set('psidAmountPkr', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={!!loading || !fields.psidNo}
              onClick={() => patch('pay_duty', fields)}>
              {loading === 'pay_duty' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Confirm Payment
            </Button>
          </div>
        </div>
      )}

      {modal === 'query' && (
        <div className="p-4 border rounded-lg bg-orange-50 border-orange-200 space-y-3">
          <p className="text-sm font-semibold text-orange-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Raise Customs Query</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Query Description</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-xs min-h-[80px] bg-white resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Describe the query raised by customs…" value={fields.queryText ?? ''}
              onChange={(e) => set('queryText', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700" disabled={!!loading || !fields.queryText}
              onClick={() => patch('raise_query', { queryText: fields.queryText, queryRaisedDate: fields.queryRaisedDate })}>
              {loading === 'raise_query' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Record Query
            </Button>
          </div>
        </div>
      )}

      {modal === 'reply' && (
        <div className="p-4 border rounded-lg bg-amber-50 border-amber-200 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Reply to Customs Query</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Reply / Resolution</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-xs min-h-[80px] bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Describe the reply / documents submitted…" value={fields.queryReply ?? ''}
              onChange={(e) => set('queryReply', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" disabled={!!loading || !fields.queryReply}
              onClick={() => patch('reply_query', { queryReply: fields.queryReply, queryRepliedDate: today })}>
              {loading === 'reply_query' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Submit Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
