'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Supplier { id: string; code: string | null; name: string }
interface Shipment { id: string; shipmentNo: string }
interface Po { id: string; poNo: string }
interface Grn { id: string; grnNo: string }
interface Lc { id: string; lcNo: string }
interface Account { code: string; name: string; accountType: string }

interface Props {
  suppliers: Supplier[];
  shipments: Shipment[];
  pos: Po[];
  grns: Grn[];
  lcs: Lc[];
  accounts: Account[];
}

interface Line { description: string; accountCode: string; amount: string; taxPct: string; taxAmount: string }

const BILL_TYPES = [
  { value: 'supplier_goods', label: 'Supplier Goods (3-way match)' },
  { value: 'clearing_agent', label: 'Clearing Agent Invoice' },
  { value: 'freight', label: 'Freight Invoice' },
  { value: 'port_charges', label: 'Port Charges' },
  { value: 'bank_lc', label: 'Bank / LC Debit Note' },
  { value: 'other', label: 'Other' },
];

const CURRENCIES = ['PKR', 'USD', 'EUR', 'CNY', 'AED'];
const PAYMENT_TYPES = [
  { value: 'tt', label: 'TT — Telegraphic Transfer' },
  { value: 'lc_settlement', label: 'LC Settlement' },
  { value: 'local_transfer', label: 'Local Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

export function BillForm({ suppliers, shipments, pos, grns, lcs, accounts }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [billType, setBillType] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState('');
  const [poId, setPoId] = useState('');
  const [grnId, setGrnId] = useState('');
  const [shipmentId, setShipmentId] = useState('');
  const [lcId, setLcId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ description: '', accountCode: '', amount: '', taxPct: '0', taxAmount: '0' }]);

  const expenseAccounts = useMemo(() => accounts.filter((a) => ['expense', 'liability', 'asset'].includes(a.accountType) && !a.name.startsWith('Total')), [accounts]);

  const addLine = () => setLines((p) => [...p, { description: '', accountCode: '', amount: '', taxPct: '0', taxAmount: '0' }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: keyof Line, val: string) =>
    setLines((p) => p.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l, [field]: val };
      if (field === 'amount' || field === 'taxPct') {
        const amt = parseFloat(next.amount || '0');
        const pct = parseFloat(next.taxPct || '0');
        next.taxAmount = String((amt * pct / 100).toFixed(2));
      }
      return next;
    }));

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const taxTotal = lines.reduce((s, l) => s + (parseFloat(l.taxAmount) || 0), 0);
  const total = subtotal + taxTotal;

  const handleSupplierSelect = (id: string) => {
    setSupplierId(id);
    const sup = suppliers.find((s) => s.id === id);
    if (sup) setSupplierName(sup.name);
  };

  const handleSubmit = async () => {
    if (!supplierName || !billType) return toast.error('Supplier name and bill type required');
    if (lines.every((l) => !l.description || !l.amount)) return toast.error('Add at least one complete line');

    setLoading(true);
    try {
      const validLines = lines.filter((l) => l.description && l.amount);
      const res = await fetch('/api/finance/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billDate, dueDate: dueDate || null, supplierName, supplierId: supplierId || null, billType, currency, exchangeRate: parseFloat(exchangeRate), poId: poId || null, grnId: grnId || null, shipmentId: shipmentId || null, lcId: lcId || null, lines: validLines, notes, supplierInvoiceNo: supplierInvoiceNo || null, supplierInvoiceDate: supplierInvoiceDate || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { bill } = await res.json();
      toast.success(`${bill.billNo} created`);
      router.push(`/finance/bills/${bill.id}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Bill Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bill Date *</label>
            <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bill Type *</label>
            <select value={billType} onChange={(e) => setBillType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select type…</option>
              {BILL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Supplier *</label>
            <select value={supplierId} onChange={(e) => handleSupplierSelect(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!supplierId && (
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Or type name manually…" className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Supplier Invoice No.</label>
            <input value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Supplier Invoice Date</label>
            <input type="date" value={supplierInvoiceDate} onChange={(e) => setSupplierInvoiceDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {currency !== 'PKR' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Exchange Rate (PKR per 1 {currency})</label>
              <input type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consignment links */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Link to Consignment (optional)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Shipment</label>
            <select value={shipmentId} onChange={(e) => setShipmentId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None</option>
              {shipments.map((s) => <option key={s.id} value={s.id}>{s.shipmentNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Purchase Order</label>
            <select value={poId} onChange={(e) => setPoId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None</option>
              {pos.map((p) => <option key={p.id} value={p.id}>{p.poNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">GRN</label>
            <select value={grnId} onChange={(e) => setGrnId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None</option>
              {grns.map((g) => <option key={g.id} value={g.id}>{g.grnNo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Letter of Credit</label>
            <select value={lcId} onChange={(e) => setLcId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">None</option>
              {lcs.map((l) => <option key={l.id} value={l.id}>{l.lcNo}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Bill Lines</CardTitle>
          <Button variant="ghost" size="sm" onClick={addLine} className="text-teal-600">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Description *</label>
                <input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" placeholder="e.g. Clearing Agent Fee" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Account</label>
                <select value={l.accountCode} onChange={(e) => updateLine(i, 'accountCode', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white">
                  <option value="">Select account…</option>
                  {expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Amount ({currency})</label>
                <input type="number" min="0" step="0.01" value={l.amount} onChange={(e) => updateLine(i, 'amount', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white text-right" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Tax %</label>
                <input type="number" min="0" step="0.1" value={l.taxPct} onChange={(e) => updateLine(i, 'taxPct', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white text-right" />
              </div>
              <div className="col-span-1 flex justify-end pb-0.5">
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="pt-2 border-t space-y-1 text-sm px-1">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {taxTotal > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>{currency} {taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Total</span>
              <span>{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {currency !== 'PKR' && (
              <div className="flex justify-between text-teal-600 font-semibold">
                <span>Total (PKR)</span>
                <span>PKR {(total * parseFloat(exchangeRate || '1')).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Create Bill
        </Button>
      </div>
    </div>
  );
}
