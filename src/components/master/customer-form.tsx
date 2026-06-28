'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users, FileText, CreditCard } from 'lucide-react';
import Link from 'next/link';

const schema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Name required'),
  customerType: z.enum(['manufacturer', 'trader', 'distributor', 'retailer', 'government']),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  cnic: z.string().optional(),
  fbrStatus: z.enum(['active', 'non_filer', 'exempt']),
  billingAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']),
  creditLimitPkr: z.coerce.number().min(0).default(0),
  salesTaxCategory: z.enum(['registered', 'unregistered', 'exempt']),
  whtRatePct: z.coerce.number().min(0).max(100).default(4.5),
  preferredPaymentMode: z.enum(['cheque', 'bank_transfer', 'cash', 'dd']),
  bankName: z.string().optional(),
  openingBalance: z.coerce.number().default(0),
});

type FormData = z.infer<typeof schema>;

interface Customer {
  id: string; code?: string | null; name: string; customerType?: string | null;
  ntn?: string | null; strn?: string | null; cnic?: string | null;
  fbrStatus?: string | null; billingAddress?: string | null; phone?: string | null;
  email?: string | null; paymentTerms?: string | null; creditLimitPkr?: string | null;
  salesTaxCategory?: string | null; whtRatePct?: string | null;
  preferredPaymentMode?: string | null; bankName?: string | null;
  openingBalance?: string | null;
}

const PAYMENT_TERMS = ['net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'cash', 'cheque', 'lc_sight', 'tt_advance'];

export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!customer;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: customer ? {
      code: customer.code ?? '',
      name: customer.name,
      customerType: (customer.customerType ?? 'manufacturer') as FormData['customerType'],
      ntn: customer.ntn ?? '',
      strn: customer.strn ?? '',
      cnic: customer.cnic ?? '',
      fbrStatus: (customer.fbrStatus ?? 'active') as FormData['fbrStatus'],
      billingAddress: customer.billingAddress ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      paymentTerms: (customer.paymentTerms ?? 'net_30') as FormData['paymentTerms'],
      creditLimitPkr: Number(customer.creditLimitPkr ?? 0),
      salesTaxCategory: (customer.salesTaxCategory ?? 'registered') as FormData['salesTaxCategory'],
      whtRatePct: Number(customer.whtRatePct ?? 4.5),
      preferredPaymentMode: (customer.preferredPaymentMode ?? 'cheque') as FormData['preferredPaymentMode'],
      bankName: customer.bankName ?? '',
      openingBalance: Number(customer.openingBalance ?? 0),
    } : {
      customerType: 'manufacturer', fbrStatus: 'active', paymentTerms: 'net_30',
      salesTaxCategory: 'registered', whtRatePct: 4.5, preferredPaymentMode: 'cheque',
      creditLimitPkr: 0, openingBalance: 0,
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = isEdit ? `/api/master/customers/${customer.id}` : '/api/master/customers';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed');
      toast.success(isEdit ? 'Customer updated' : 'Customer created');
      router.push('/master/customers');
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/master/customers">
          <Button type="button" variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
      </div>

      {/* Core */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Customer Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Customer Code</Label>
            <Input className="font-mono" placeholder="Auto-generated if blank" {...register('code')} />
          </div>
          <div className="space-y-1.5">
            <Label>Customer Type <span className="text-red-500">*</span></Label>
            <Select defaultValue={customer?.customerType ?? 'manufacturer'} onValueChange={(v) => setValue('customerType', v as FormData['customerType'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['manufacturer', 'trader', 'distributor', 'retailer', 'government'].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Company / Customer Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. National Foods Limited" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input placeholder="+92 21 111 000 111" {...register('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="accounts@customer.com.pk" {...register('email')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Billing Address</Label>
            <Textarea rows={2} placeholder="Complete registered address" {...register('billingAddress')} />
          </div>
        </CardContent>
      </Card>

      {/* Tax / FBR */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Tax Registration (FBR)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>NTN</Label>
            <Input className="font-mono" placeholder="1234567-8" {...register('ntn')} />
          </div>
          <div className="space-y-1.5">
            <Label>STRN</Label>
            <Input className="font-mono" placeholder="12-34-5678-901-12" {...register('strn')} />
          </div>
          <div className="space-y-1.5">
            <Label>CNIC (if individual)</Label>
            <Input className="font-mono" placeholder="42201-1234567-1" {...register('cnic')} />
          </div>
          <div className="space-y-1.5">
            <Label>FBR Status</Label>
            <Select defaultValue={customer?.fbrStatus ?? 'active'} onValueChange={(v) => setValue('fbrStatus', v as FormData['fbrStatus'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Filer</SelectItem>
                <SelectItem value="non_filer">Non-Filer (higher WHT)</SelectItem>
                <SelectItem value="exempt">Exempt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sales Tax Category</Label>
            <Select defaultValue={customer?.salesTaxCategory ?? 'registered'} onValueChange={(v) => setValue('salesTaxCategory', v as FormData['salesTaxCategory'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="registered">Registered (ST 17%)</SelectItem>
                <SelectItem value="unregistered">Unregistered (enhanced rate)</SelectItem>
                <SelectItem value="exempt">Exempt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>WHT Rate % (Sec 153)</Label>
            <Input type="number" step="0.01" min={0} max={100} {...register('whtRatePct')} />
            <p className="text-xs text-slate-400">Default 4.5% (filer), 8% (non-filer)</p>
          </div>
        </CardContent>
      </Card>

      {/* Credit & Payment */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Credit & Payment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Payment Terms</Label>
            <Select defaultValue={customer?.paymentTerms ?? 'net_30'} onValueChange={(v) => setValue('paymentTerms', v as FormData['paymentTerms'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'cash', 'lc_sight', 'tt_advance'].map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Preferred Payment Mode</Label>
            <Select defaultValue={customer?.preferredPaymentMode ?? 'cheque'} onValueChange={(v) => setValue('preferredPaymentMode', v as FormData['preferredPaymentMode'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer (IBFT)</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="dd">Demand Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Credit Limit (PKR)</Label>
            <Input type="number" min={0} step={1000} placeholder="0" {...register('creditLimitPkr')} />
          </div>
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input placeholder="Habib Bank Limited" {...register('bankName')} />
          </div>
          <div className="space-y-1.5">
            <Label>Opening Balance (PKR)</Label>
            <Input type="number" step="0.01" {...register('openingBalance')} />
            <p className="text-xs text-slate-400">Positive = receivable, negative = advance received</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Link href="/master/customers">
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}
