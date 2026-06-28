'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

const PAYMENT_TERMS = ['cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'];
const PAYMENT_MODES = ['cheque', 'rtgs', 'ibft', 'cash'];

interface Props { customerId?: string; initial?: Record<string, string | boolean | null> }

export function CustomerForm({ customerId, initial }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: String(initial?.name ?? ''),
    customerType: String(initial?.customerType ?? 'manufacturer'),
    ntn: String(initial?.ntn ?? ''),
    strn: String(initial?.strn ?? ''),
    cnic: String(initial?.cnic ?? ''),
    fbrStatus: String(initial?.fbrStatus ?? 'active'),
    billingAddress: String(initial?.billingAddress ?? ''),
    phone: String(initial?.phone ?? ''),
    email: String(initial?.email ?? ''),
    paymentTerms: String(initial?.paymentTerms ?? 'net_30'),
    creditLimitPkr: String(initial?.creditLimitPkr ?? ''),
    salesTaxCategory: String(initial?.salesTaxCategory ?? 'registered'),
    whtRatePct: String(initial?.whtRatePct ?? '4.5'),
    preferredPaymentMode: String(initial?.preferredPaymentMode ?? 'cheque'),
    bankName: String(initial?.bankName ?? ''),
    openingBalance: String(initial?.openingBalance ?? ''),
    notes: String(initial?.notes ?? ''),
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Auto-set WHT rate based on FBR status
  const onFbrChange = (v: string) => {
    set('fbrStatus', v);
    if (v === 'non_filer') set('whtRatePct', '8');
    else if (v === 'active') set('whtRatePct', '4.5');
    else set('whtRatePct', '0');
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Customer name is required');
    setLoading(true);
    try {
      const url = customerId ? `/api/customers/${customerId}` : '/api/customers';
      const method = customerId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const data = await res.json();
      toast.success(customerId ? 'Customer updated' : 'Customer created');
      router.push(`/sales/customers/${customerId ?? data.id}`);
      router.refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={(form as any)[key]} onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder} className="w-full border rounded-lg px-3 py-2 text-sm" />
    </div>
  );

  const select = (label: string, key: string, options: { value: string; label: string }[], onChange?: (v: string) => void) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select value={(form as any)[key]} onChange={(e) => (onChange ?? ((v: string) => set(key, v)))(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Identity */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Company Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">{field('Company Name *', 'name', 'text', 'e.g. Al-Kareem Industries')}</div>
          {select('Customer Type', 'customerType', [
            { value: 'manufacturer', label: 'Manufacturer' },
            { value: 'trader', label: 'Trader' },
            { value: 'distributor', label: 'Distributor' },
            { value: 'retailer', label: 'Retailer' },
            { value: 'government', label: 'Government' },
          ])}
          {field('Phone', 'phone', 'tel', '+92-XXX-XXXXXXX')}
          {field('Email', 'email', 'email', 'accounts@company.com')}
          <div className="col-span-2">{field('Billing Address', 'billingAddress', 'text', 'Street, City, Province')}</div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Notes / Internal Remarks</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Tax & FBR */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Tax & FBR Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {field('NTN', 'ntn', 'text', '1234567-8')}
          {field('STRN', 'strn', 'text', 'XX-XX-XXXX-XXX-XX')}
          {field('CNIC (if sole proprietor)', 'cnic', 'text', '35202-XXXXXXX-X')}
          {select('FBR Status', 'fbrStatus', [
            { value: 'active', label: 'Active Taxpayer' },
            { value: 'non_filer', label: 'Non-Filer' },
            { value: 'exempt', label: 'Exempt' },
          ], onFbrChange)}
          {select('Sales Tax Category', 'salesTaxCategory', [
            { value: 'registered', label: 'Registered (17% ST)' },
            { value: 'unregistered', label: 'Unregistered (extra WHT)' },
            { value: 'exempt', label: 'Exempt' },
          ])}
          {field('WHT Rate Sec 153 (%)', 'whtRatePct', 'number')}
        </CardContent>
      </Card>

      {/* Credit & Payment */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Credit & Payment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {select('Payment Terms', 'paymentTerms', PAYMENT_TERMS.map((t) => ({ value: t, label: t.replace('_', ' ').replace('net', 'Net') })))}
          {field('Credit Limit (PKR)', 'creditLimitPkr', 'number', '0')}
          {select('Preferred Payment Mode', 'preferredPaymentMode', PAYMENT_MODES.map((m) => ({ value: m, label: m.toUpperCase() })))}
          {field('Bank Name', 'bankName', 'text', 'HBL / MCB / UBL…')}
          {field('Opening Balance (PKR)', 'openingBalance', 'number', '0')}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {customerId ? 'Save Changes' : 'Create Customer'}
        </Button>
      </div>
    </div>
  );
}
