'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react';

interface Props { billId: string; status: string; balanceDue: string; currency: string }

const PAYMENT_TYPES = [
  { value: 'tt', label: 'TT — Telegraphic Transfer' },
  { value: 'lc_settlement', label: 'LC Settlement' },
  { value: 'local_transfer', label: 'Local Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

export function BillPaymentPanel({ billId, status, balanceDue, currency }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentType: 'local_transfer',
    amount: balanceDue,
    paymentCurrency: currency,
    exchangeRate: '1',
    bankRef: '',
    bankName: '',
    bankAccountCode: '',
    formMNo: '',
    notes: '',
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handlePay = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount');
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay', paymentDate: form.paymentDate, paymentType: form.paymentType, amount: form.amount, currency: form.paymentCurrency, exchangeRate: form.exchangeRate, bankRef: form.bankRef || null, bankName: form.bankName || null, bankAccountCode: form.bankAccountCode || null, formMNo: form.formMNo || null, notes: form.notes || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Payment failed');
      toast.success('Payment recorded');
      setOpen(false);
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const isForeign = form.paymentCurrency !== 'PKR';

  if (status === 'paid') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-green-700 font-medium">Fully paid</span>
      </div>
    );
  }

  if (status === 'cancelled') return null;

  return (
    <div className="space-y-3">
      {!open && (
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setOpen(true)}>
          <CreditCard className="mr-1.5 h-4 w-4" /> Record Payment
        </Button>
      )}
      {open && (
        <div className="p-4 border rounded-lg bg-teal-50 border-teal-200 space-y-3">
          <p className="text-sm font-semibold text-teal-800">Record Payment</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Payment Date</label>
              <input type="date" value={form.paymentDate} onChange={(e) => set('paymentDate', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Payment Type</label>
              <select value={form.paymentType} onChange={(e) => set('paymentType', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white">
                {PAYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Currency</label>
              <select value={form.paymentCurrency} onChange={(e) => set('paymentCurrency', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white">
                {['PKR', 'USD', 'EUR', 'CNY', 'AED'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Amount ({form.paymentCurrency})</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white text-right" />
            </div>
            {isForeign && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Exchange Rate</label>
                <input type="number" step="0.0001" value={form.exchangeRate} onChange={(e) => set('exchangeRate', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bank Ref / Cheque No.</label>
              <input value={form.bankRef} onChange={(e) => set('bankRef', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bank Name</label>
              <input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
            </div>
            {['tt', 'lc_settlement'].includes(form.paymentType) && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">SBP Form-M No.</label>
                <input value={form.formMNo} onChange={(e) => set('formMNo', e.target.value)} placeholder="For foreign payments" className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={1} className="w-full border rounded px-2 py-1.5 text-sm bg-white resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handlePay} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Confirm Payment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
