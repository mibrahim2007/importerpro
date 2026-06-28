'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Account { code: string; name: string; accountType: string }
interface Props { accounts: Account[] }

interface Line { accountCode: string; accountName: string; description: string; debit: string; credit: string }

const JE_TEMPLATES = [
  {
    label: 'GD Assessment',
    lines: [
      { accountCode: '5200', accountName: 'Customs Duty Expense', description: 'Customs Duty', debit: '', credit: '' },
      { accountCode: '1401', accountName: 'Prepaid Import Duties (ST Adj.)', description: 'Sales Tax Adjustable', debit: '', credit: '' },
      { accountCode: '2201', accountName: 'Sales Tax Payable (FBR)', description: 'Sales Tax Non-Adj.', debit: '', credit: '' },
      { accountCode: '2202', accountName: 'Income Tax Payable (WHT)', description: 'WHT Payable', debit: '', credit: '' },
      { accountCode: '2101', accountName: 'Trade Creditors', description: 'Duty Payable', debit: '', credit: '' },
    ],
    description: 'GD Assessment — Customs Duty & Taxes',
  },
  {
    label: 'PSID Duty Payment',
    lines: [
      { accountCode: '2101', accountName: 'Trade Creditors', description: 'Duty Payable', debit: '', credit: '' },
      { accountCode: '1102', accountName: 'Bank — Current Account', description: 'PSID Challan Payment', debit: '', credit: '' },
    ],
    description: 'PSID Challan — Duty Payment to FBR',
  },
  {
    label: 'GRN — Inventory',
    lines: [
      { accountCode: '1301', accountName: 'Raw Material Stock', description: 'Goods Received', debit: '', credit: '' },
      { accountCode: '2101', accountName: 'Trade Creditors (GRN Clearing)', description: 'GRN Clearing', debit: '', credit: '' },
    ],
    description: 'GRN Posting — Inventory Receipt',
  },
  {
    label: 'Vendor Bill Match',
    lines: [
      { accountCode: '2101', accountName: 'Trade Creditors (GRN Clearing)', description: 'GRN Clearing', debit: '', credit: '' },
      { accountCode: '2101', accountName: 'Trade Creditors', description: 'Accounts Payable Supplier', debit: '', credit: '' },
    ],
    description: 'Vendor Bill 3-Way Match',
  },
];

export function JournalEntryForm({ accounts }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [jeDate, setJeDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([
    { accountCode: '', accountName: '', description: '', debit: '', credit: '' },
    { accountCode: '', accountName: '', description: '', debit: '', credit: '' },
  ]);

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.name.startsWith('Total')), [accounts]);

  const addLine = () => setLines((p) => [...p, { accountCode: '', accountName: '', description: '', debit: '', credit: '' }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: keyof Line, val: string) =>
    setLines((p) => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleAccountChange = (i: number, code: string) => {
    const acc = accounts.find((a) => a.code === code);
    setLines((p) => p.map((l, idx) => idx === i ? { ...l, accountCode: code, accountName: acc?.name ?? '' } : l));
  };

  const applyTemplate = (tpl: typeof JE_TEMPLATES[0]) => {
    setDescription(tpl.description);
    setLines(tpl.lines.map((l) => ({ ...l })));
  };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSubmit = async () => {
    if (!description) return toast.error('Description required');
    if (!balanced) return toast.error(`Entry does not balance: Dr ${totalDebit.toFixed(2)} ≠ Cr ${totalCredit.toFixed(2)}`);
    const validLines = lines.filter((l) => l.accountCode && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) return toast.error('At least 2 lines with amounts required');

    setLoading(true);
    try {
      const res = await fetch('/api/finance/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jeDate, description, reference: reference || null, referenceType: 'manual', lines: validLines }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { entry } = await res.json();
      toast.success(`${entry.jeNo} created`);
      router.push(`/finance/journal/${entry.id}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Templates */}
      <Card className="border-dashed border-teal-300 bg-teal-50">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-teal-700 mb-2 uppercase tracking-wide">Quick Templates</p>
          <div className="flex flex-wrap gap-2">
            {JE_TEMPLATES.map((t) => (
              <button key={t.label} onClick={() => applyTemplate(t)}
                className="px-3 py-1.5 rounded-lg border border-teal-300 text-xs font-medium text-teal-700 bg-white hover:bg-teal-100 transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entry Header</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date *</label>
            <input type="date" value={jeDate} onChange={(e) => setJeDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Description *</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. GD Assessment — SHP-2026-0045" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Reference</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="GD no., Bill no., etc." className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Debit / Credit Lines</CardTitle>
          <Button variant="ghost" size="sm" onClick={addLine} className="text-teal-600">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Account</label>
                <select value={l.accountCode} onChange={(e) => handleAccountChange(i, e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white">
                  <option value="">Select account…</option>
                  {activeAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Narration</label>
                <input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1 text-green-600">Debit (Dr)</label>
                <input type="number" min="0" step="0.01" value={l.debit} onChange={(e) => { updateLine(i, 'debit', e.target.value); if (e.target.value) updateLine(i, 'credit', ''); }}
                  className="w-full border border-green-200 rounded px-2 py-1.5 text-sm bg-white text-right" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1 text-red-500">Credit (Cr)</label>
                <input type="number" min="0" step="0.01" value={l.credit} onChange={(e) => { updateLine(i, 'credit', e.target.value); if (e.target.value) updateLine(i, 'debit', ''); }}
                  className="w-full border border-red-200 rounded px-2 py-1.5 text-sm bg-white text-right" />
              </div>
              <div className="col-span-1 flex justify-end">
                {lines.length > 2 && (
                  <button onClick={() => removeLine(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Balance checker */}
          <div className={`flex items-center justify-between p-3 rounded-lg border text-sm mt-2 ${balanced ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2">
              {balanced ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
              <span className={balanced ? 'text-green-700 font-semibold' : 'text-amber-700 font-semibold'}>
                {balanced ? 'Entry balanced' : 'Entry does not balance'}
              </span>
            </div>
            <div className="flex gap-6 font-mono text-sm">
              <span className="text-green-700">Dr: {totalDebit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              <span className="text-red-600">Cr: {totalCredit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              {!balanced && totalDebit > 0 && (
                <span className="text-amber-600">Diff: {Math.abs(totalDebit - totalCredit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit} disabled={loading || !balanced}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Create Entry
        </Button>
      </div>
    </div>
  );
}
