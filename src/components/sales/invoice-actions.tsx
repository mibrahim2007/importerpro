'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, FileCheck, Send, DollarSign, XCircle } from 'lucide-react';

interface Props { invoiceId: string; status: string }

export function InvoiceActions({ invoiceId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'idle' | 'payment' | 'cancel'>('idle');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const doAction = async (action: string, extra: object = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/invoices/${invoiceId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      const messages: Record<string, string> = {
        post: 'Invoice posted — ready to send to customer',
        send: 'Invoice marked as sent',
        record_payment: `Payment of PKR ${parseFloat(amount).toLocaleString('en-PK')} recorded`,
        cancel: 'Invoice cancelled',
      };
      toast.success(messages[action] ?? 'Done');
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setMode('idle'); }
  };

  const isTerminal = ['fully_paid', 'cancelled'].includes(status);
  if (isTerminal) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>}

        {!loading && mode === 'idle' && (
          <div className="space-y-2">
            {status === 'draft' && (
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => doAction('post')}>
                <FileCheck className="mr-1.5 h-3.5 w-3.5" />Post Invoice
              </Button>
            )}
            {status === 'posted' && (
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => doAction('send')}>
                <Send className="mr-1.5 h-3.5 w-3.5" />Mark as Sent
              </Button>
            )}
            {['posted', 'sent', 'partially_paid', 'overdue'].includes(status) && (
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => setMode('payment')}>
                <DollarSign className="mr-1.5 h-3.5 w-3.5" />Record Payment
              </Button>
            )}
            {['draft', 'posted', 'sent'].includes(status) && (
              <Button size="sm" variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setMode('cancel')}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />Cancel Invoice
              </Button>
            )}
          </div>
        )}

        {!loading && mode === 'payment' && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Amount (PKR) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Reference No</label>
              <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Cheque / TT no." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" disabled={!amount}
                onClick={() => doAction('record_payment', { paymentDate, amountPkr: amount, paymentMethod: payMethod, referenceNo })}>
                Record
              </Button>
            </div>
          </div>
        )}

        {!loading && mode === 'cancel' && (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Cancellation Reason</label>
            <textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Required for audit trail" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('idle')}>Back</Button>
              <Button size="sm" variant="destructive" className="flex-1" disabled={!cancelReason}
                onClick={() => doAction('cancel', { reason: cancelReason })}>Cancel Invoice</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
