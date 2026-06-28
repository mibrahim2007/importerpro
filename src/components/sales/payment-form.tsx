'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Info } from 'lucide-react';

interface CustomerOption { id: string; name: string; code: string | null; preferredPaymentMode: string | null; bankName: string | null }
interface OpenInvoice { id: string; invoiceNo: string; invoiceDate: string; dueDate: string | null; grandTotalPkr: string | null; balancePkr: string | null; status: string | null }
interface Allocation { invoiceId: string; allocatedAmountPkr: string }

const METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer (TT/IBFT)' },
  { value: 'cheque', label: 'Cheque (Same-day)' },
  { value: 'pdc', label: 'PDC (Post-Dated Cheque)' },
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online Payment' },
];
const TODAY = new Date().toISOString().split('T')[0];

export function PaymentForm({ customers, prefillCustomerId, initialOpenInvoices }: {
  customers: CustomerOption[];
  prefillCustomerId?: string;
  initialOpenInvoices: OpenInvoice[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState(prefillCustomerId ?? '');
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>(initialOpenInvoices);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    receiptDate: TODAY, paymentMethod: 'bank_transfer', bankName: '', branchCode: '',
    chequeNo: '', chequeDueDate: '', referenceNo: '', notes: '',
  });

  const selectedCustomer = customers.find((c) => c.id === customerId);

  useEffect(() => {
    if (selectedCustomer?.preferredPaymentMode) setF('paymentMethod', selectedCustomer.preferredPaymentMode);
    if (selectedCustomer?.bankName) setF('bankName', selectedCustomer.bankName);
  }, [customerId]);

  // Fetch open invoices when customer changes
  useEffect(() => {
    if (!customerId || customerId === prefillCustomerId) return;
    setLoadingInvoices(true);
    setAllocations({});
    fetch(`/api/sales/invoices?customerId=${customerId}`)
      .then((r) => r.json())
      .then((rows: any[]) => {
        const open = rows.filter((r) => !['draft', 'cancelled', 'fully_paid'].includes(r.status) && parseFloat(r.balancePkr ?? '0') > 0);
        setOpenInvoices(open);
      })
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, [customerId]);

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setAlloc = (invoiceId: string, v: string) => setAllocations((p) => ({ ...p, [invoiceId]: v }));

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + parseFloat(v || '0'), 0);
  const totalAmount = parseFloat(form.paymentMethod === 'pdc' ? '0' : '0'); // user enters manually
  const isPdc = form.paymentMethod === 'pdc';

  // Auto-fill total from allocations
  const handleAllocAll = () => {
    const newAllocs: Record<string, string> = {};
    for (const inv of openInvoices) {
      newAllocs[inv.id] = inv.balancePkr ?? '0';
    }
    setAllocations(newAllocs);
  };

  const handleSave = async () => {
    if (!customerId) return toast.error('Select a customer');
    const nonZeroAllocs: Allocation[] = Object.entries(allocations)
      .filter(([, v]) => parseFloat(v || '0') > 0)
      .map(([invoiceId, v]) => ({ invoiceId, allocatedAmountPkr: v }));

    // Total = sum of allocations (or manual if advance payment)
    const total = totalAllocated || 0;
    if (total <= 0) return toast.error('Enter at least one allocated amount');

    if (isPdc && !form.chequeNo) return toast.error('Cheque number required for PDC');
    if (isPdc && !form.chequeDueDate) return toast.error('Cheque due date required for PDC');

    setSaving(true);
    try {
      const res = await fetch('/api/sales/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptDate: form.receiptDate, customerId,
          totalAmountPkr: String(total.toFixed(2)),
          paymentMethod: form.paymentMethod,
          bankName: form.bankName || null, branchCode: form.branchCode || null,
          chequeNo: form.chequeNo || null, chequeDueDate: form.chequeDueDate || null,
          referenceNo: form.referenceNo || null, notes: form.notes || null,
          allocations: nonZeroAllocs,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(`Receipt ${data.receiptNo} saved${isPdc ? ' — PDC pending clearance' : ''}`);
      router.push(`/sales/payments/${data.id}`);
    } catch { toast.error('Failed to save receipt'); }
    finally { setSaving(false); }
  };

  const today = TODAY;
  const fmt = (v: string | null) => v ? parseFloat(v).toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '0';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Receipt Date *</label>
            <input type="date" value={form.receiptDate} onChange={(e) => setF('receiptDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Method *</label>
            <select value={form.paymentMethod} onChange={(e) => setF('paymentMethod', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bank Name</label>
            <input value={form.bankName} onChange={(e) => setF('bankName', e.target.value)} placeholder="e.g. HBL, MCB, UBL" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Branch Code</label>
            <input value={form.branchCode} onChange={(e) => setF('branchCode', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
          </div>

          {(form.paymentMethod === 'cheque' || isPdc) && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cheque No *</label>
              <input value={form.chequeNo} onChange={(e) => setF('chequeNo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="0000000" />
            </div>
          )}
          {isPdc && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cheque Due Date *</label>
              <input type="date" value={form.chequeDueDate} onChange={(e) => setF('chequeDueDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          {(form.paymentMethod === 'bank_transfer' || form.paymentMethod === 'online') && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">TT / IBFT Reference No</label>
              <input value={form.referenceNo} onChange={(e) => setF('referenceNo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="TXN123456789" />
            </div>
          )}
          <div className="col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <input value={form.notes} onChange={(e) => setF('notes', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
          </div>
        </CardContent>
      </Card>

      {/* Invoice Allocation */}
      {customerId && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Allocate to Open Invoices</CardTitle>
            {openInvoices.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleAllocAll}>Allocate All</Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loadingInvoices && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>}
            {!loadingInvoices && openInvoices.length === 0 && (
              <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
                <Info className="h-4 w-4" />No open invoices — this will be recorded as advance payment
              </div>
            )}
            {!loadingInvoices && openInvoices.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['Invoice No', 'Invoice Date', 'Due Date', 'Total', 'Balance Due', 'Allocate (PKR)'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv) => {
                    const isOverdue = inv.dueDate && inv.dueDate < today;
                    return (
                      <tr key={inv.id} className="border-b">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-teal-700">{inv.invoiceNo}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{inv.invoiceDate}</td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}>{inv.dueDate ?? '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">PKR {fmt(inv.grandTotalPkr)}</td>
                        <td className="px-4 py-2.5 font-semibold text-red-600">PKR {fmt(inv.balancePkr)}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            max={inv.balancePkr ?? undefined}
                            value={allocations[inv.id] ?? ''}
                            onChange={(e) => setAlloc(inv.id, e.target.value)}
                            className="border rounded px-2 py-1.5 text-xs w-32 text-right"
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t">
                    <td colSpan={5} className="px-4 py-2 text-xs text-right text-slate-500">Total Allocated</td>
                    <td className="px-4 py-2 font-bold text-teal-700">PKR {totalAllocated.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {isPdc && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          PDC receipts are saved with status <strong>Pending</strong>. Invoice balances will only update when you manually clear the cheque on the receipt detail page.
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Save Receipt {totalAllocated > 0 ? `(PKR ${totalAllocated.toLocaleString('en-PK', { maximumFractionDigits: 0 })})` : ''}
        </Button>
      </div>
    </div>
  );
}
