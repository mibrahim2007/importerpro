'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Building2, CreditCard, Phone } from 'lucide-react';
import { useState } from 'react';

const schema = z.object({
  companyName: z.string().min(2),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  businessAddress: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  // Extended settings stored in tenant_settings
  companyWebsite: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankIban: z.string().optional(),
  bankSwiftCode: z.string().optional(),
  fiscalYearStart: z.string().optional(), // MM-DD
});

type FormData = z.infer<typeof schema>;

interface Tenant {
  id: string;
  companyName: string;
  ntn?: string | null;
  strn?: string | null;
  businessAddress?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function CompanyProfileForm({ tenant }: { tenant: Tenant }) {
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      companyName: tenant.companyName,
      ntn: tenant.ntn ?? '',
      strn: tenant.strn ?? '',
      businessAddress: tenant.businessAddress ?? '',
      contactPerson: tenant.contactPerson ?? '',
      contactEmail: tenant.contactEmail ?? '',
      contactPhone: tenant.contactPhone ?? '',
      fiscalYearStart: '07-01',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Company profile updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Legal Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Legal Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Company Name <span className="text-red-500">*</span></Label>
            <Input {...register('companyName')} />
            {errors.companyName && <p className="text-xs text-red-500">{errors.companyName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>NTN (National Tax Number)</Label>
            <Input placeholder="1234567-8" {...register('ntn')} />
          </div>
          <div className="space-y-1.5">
            <Label>STRN (Sales Tax Reg No)</Label>
            <Input placeholder="12-34-5678-901-12" {...register('strn')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Registered Business Address</Label>
            <Textarea rows={2} placeholder="Plot 12, SITE Industrial Area, Karachi, Sindh" {...register('businessAddress')} />
          </div>
          <div className="space-y-1.5">
            <Label>Company Website</Label>
            <Input placeholder="https://www.company.com.pk" {...register('companyWebsite')} />
          </div>
          <div className="space-y-1.5">
            <Label>Fiscal Year Start (MM-DD)</Label>
            <Input placeholder="07-01" {...register('fiscalYearStart')} />
            <p className="text-xs text-slate-400">Pakistan default is July 1 (07-01)</p>
          </div>
        </CardContent>
      </Card>

      {/* Primary Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4" /> Primary Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Contact Person</Label>
            <Input placeholder="Ahmad Ali" {...register('contactPerson')} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="admin@company.com.pk" {...register('contactEmail')} />
            {errors.contactEmail && <p className="text-xs text-red-500">{errors.contactEmail.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone / WhatsApp</Label>
            <Input placeholder="+92 300 1234567" {...register('contactPhone')} />
          </div>
        </CardContent>
      </Card>

      {/* Banking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Primary Bank Account
          </CardTitle>
          <p className="text-xs text-slate-400">Used for LC issuance and payment references on documents</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input placeholder="MCB Bank Limited" {...register('bankName')} />
          </div>
          <div className="space-y-1.5">
            <Label>Account Number</Label>
            <Input placeholder="0123456789012" {...register('bankAccountNo')} />
          </div>
          <div className="space-y-1.5">
            <Label>IBAN</Label>
            <Input className="font-mono" placeholder="PK36MUCB0001234567890123" {...register('bankIban')} />
          </div>
          <div className="space-y-1.5">
            <Label>SWIFT / BIC Code</Label>
            <Input className="font-mono" placeholder="MUCBPKKA" {...register('bankSwiftCode')} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !isDirty} className="bg-teal-600 hover:bg-teal-700">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
