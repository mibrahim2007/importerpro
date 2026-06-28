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
import { ArrowLeft, Loader2, Globe, CreditCard, Ship } from 'lucide-react';
import Link from 'next/link';

const schema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Name required'),
  country: z.string().optional(),
  supplierType: z.enum(['manufacturer', 'trader', 'clearing_agent', 'freight_forwarder', 'shipping_line', 'port_agent']),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankSwift: z.string().optional(),
  bankCurrency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']),
  preferredIncoterms: z.enum(['FOB', 'CFR', 'CIF', 'EXW', 'DDP']),
  defaultPortOfLoading: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  complianceStatus: z.enum(['active', 'blacklisted', 'under_review']),
  customsLicenseNo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Supplier {
  id: string; code?: string | null; name: string; country?: string | null;
  supplierType?: string | null; address?: string | null; email?: string | null;
  phone?: string | null; whatsapp?: string | null; bankName?: string | null;
  bankIban?: string | null; bankSwift?: string | null; bankCurrency?: string | null;
  paymentTerms?: string | null; preferredIncoterms?: string | null;
  defaultPortOfLoading?: string | null; leadTimeDays?: number | null;
  complianceStatus?: string | null; customsLicenseNo?: string | null;
}

const PAYMENT_TERMS = ['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'];

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!supplier;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: supplier ? {
      code: supplier.code ?? '',
      name: supplier.name,
      country: supplier.country ?? '',
      supplierType: (supplier.supplierType ?? 'manufacturer') as FormData['supplierType'],
      address: supplier.address ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      whatsapp: supplier.whatsapp ?? '',
      bankName: supplier.bankName ?? '',
      bankIban: supplier.bankIban ?? '',
      bankSwift: supplier.bankSwift ?? '',
      bankCurrency: (supplier.bankCurrency ?? 'USD') as FormData['bankCurrency'],
      paymentTerms: (supplier.paymentTerms ?? 'lc_sight') as FormData['paymentTerms'],
      preferredIncoterms: (supplier.preferredIncoterms ?? 'CIF') as FormData['preferredIncoterms'],
      defaultPortOfLoading: supplier.defaultPortOfLoading ?? '',
      leadTimeDays: supplier.leadTimeDays ?? 0,
      complianceStatus: (supplier.complianceStatus ?? 'active') as FormData['complianceStatus'],
      customsLicenseNo: supplier.customsLicenseNo ?? '',
    } : { supplierType: 'manufacturer', bankCurrency: 'USD', paymentTerms: 'lc_sight', preferredIncoterms: 'CIF', complianceStatus: 'active' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = isEdit ? `/api/master/suppliers/${supplier.id}` : '/api/master/suppliers';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed');
      toast.success(isEdit ? 'Supplier updated' : 'Supplier created');
      router.push('/master/suppliers');
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
        <Link href="/master/suppliers">
          <Button type="button" variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
      </div>

      {/* Core */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Supplier Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Supplier Code</Label>
            <Input className="font-mono" placeholder="Auto-generated if blank" {...register('code')} />
          </div>
          <div className="space-y-1.5">
            <Label>Type <span className="text-red-500">*</span></Label>
            <Select defaultValue={supplier?.supplierType ?? 'manufacturer'} onValueChange={(v) => setValue('supplierType', v as FormData['supplierType'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['manufacturer', 'trader', 'clearing_agent', 'freight_forwarder', 'shipping_line', 'port_agent'].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Company Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Shandong Chemical Co., Ltd." {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input placeholder="China" {...register('country')} />
          </div>
          <div className="space-y-1.5">
            <Label>Customs License No.</Label>
            <Input placeholder="Agent license if applicable" {...register('customsLicenseNo')} className="font-mono" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Textarea rows={2} placeholder="Full business address" {...register('address')} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="sales@supplier.com" {...register('email')} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input placeholder="+86 21 1234 5678" {...register('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input placeholder="+86 135 1234 5678" {...register('whatsapp')} />
          </div>
          <div className="space-y-1.5">
            <Label>Compliance Status</Label>
            <Select defaultValue={supplier?.complianceStatus ?? 'active'} onValueChange={(v) => setValue('complianceStatus', v as FormData['complianceStatus'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Trade Terms */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Ship className="h-4 w-4" /> Trade Terms</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Payment Terms</Label>
            <Select defaultValue={supplier?.paymentTerms ?? 'lc_sight'} onValueChange={(v) => setValue('paymentTerms', v as FormData['paymentTerms'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Preferred Incoterms</Label>
            <Select defaultValue={supplier?.preferredIncoterms ?? 'CIF'} onValueChange={(v) => setValue('preferredIncoterms', v as FormData['preferredIncoterms'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['FOB', 'CFR', 'CIF', 'EXW', 'DDP'].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default Port of Loading</Label>
            <Input placeholder="e.g. Shanghai, Qingdao, Tianjin" {...register('defaultPortOfLoading')} />
          </div>
          <div className="space-y-1.5">
            <Label>Lead Time (days)</Label>
            <Input type="number" min={0} placeholder="30" {...register('leadTimeDays')} />
          </div>
        </CardContent>
      </Card>

      {/* Banking */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Bank Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input placeholder="Bank of China" {...register('bankName')} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select defaultValue={supplier?.bankCurrency ?? 'USD'} onValueChange={(v) => setValue('bankCurrency', v as FormData['bankCurrency'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>IBAN / Account No.</Label>
            <Input className="font-mono" placeholder="Account number" {...register('bankIban')} />
          </div>
          <div className="space-y-1.5">
            <Label>SWIFT / BIC</Label>
            <Input className="font-mono" placeholder="BKCHCNBJ" {...register('bankSwift')} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Link href="/master/suppliers">
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Supplier'}
        </Button>
      </div>
    </form>
  );
}
