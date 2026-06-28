'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Building2 } from 'lucide-react';
import Link from 'next/link';

const schema = z.object({
  companyName: z.string().min(2, 'Company name required'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  plan: z.enum(['starter', 'growth', 'enterprise', 'custom']),
  businessAddress: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  adminName: z.string().min(1, 'Admin name required'),
  adminEmail: z.string().email('Valid email required'),
  adminPassword: z.string().min(8, 'Min 8 characters'),
});

type FormData = z.infer<typeof schema>;

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function NewTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'starter' },
  });

  const companyName = watch('companyName');

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed');
      }
      toast.success(`Tenant "${data.companyName}" created successfully`);
      router.push('/admin/tenants');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">New Tenant</h1>
          <p className="text-sm text-slate-500">Creates a new isolated database schema for this tenant</p>
        </div>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Company Name <span className="text-red-500">*</span></Label>
            <Input
              placeholder="MCL Chemicals Pvt Ltd"
              {...register('companyName')}
              onChange={(e) => {
                register('companyName').onChange(e);
                if (!watch('slug')) setValue('slug', toSlug(e.target.value));
              }}
            />
            {errors.companyName && <p className="text-xs text-red-500">{errors.companyName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>
              Workspace Slug <span className="text-red-500">*</span>
              <span className="text-slate-400 text-xs ml-1">(auto-generated, unique)</span>
            </Label>
            <Input placeholder="mcl-chemicals" {...register('slug')} className="font-mono" />
            {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Subscription Plan <span className="text-red-500">*</span></Label>
            <Select defaultValue="starter" onValueChange={(v) => setValue('plan', v as FormData['plan'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter — 5 users, 2 WH, 20 consignments/mo</SelectItem>
                <SelectItem value="growth">Growth — 20 users, 10 WH, 100 consignments/mo</SelectItem>
                <SelectItem value="enterprise">Enterprise — Unlimited</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
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
            <Label>Business Address</Label>
            <Textarea placeholder="Plot 12, SITE Industrial Area, Karachi" rows={2} {...register('businessAddress')} />
          </div>
        </CardContent>
      </Card>

      {/* Contact Person */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Contact Person</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Ahmad Ali" {...register('contactPerson')} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="ahmad@mcl.com" {...register('contactEmail')} />
            {errors.contactEmail && <p className="text-xs text-red-500">{errors.contactEmail.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input placeholder="+92 300 1234567" {...register('contactPhone')} />
          </div>
        </CardContent>
      </Card>

      {/* Admin Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tenant Admin Account</CardTitle>
          <p className="text-xs text-slate-500">First user for this tenant with Tenant Admin role</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name <span className="text-red-500">*</span></Label>
            <Input placeholder="Ahmad Ali" {...register('adminName')} />
            {errors.adminName && <p className="text-xs text-red-500">{errors.adminName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Email <span className="text-red-500">*</span></Label>
            <Input type="email" placeholder="admin@mcl.com" {...register('adminEmail')} />
            {errors.adminEmail && <p className="text-xs text-red-500">{errors.adminEmail.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Password <span className="text-red-500">*</span></Label>
            <Input type="password" placeholder="Min 8 characters" {...register('adminPassword')} />
            {errors.adminPassword && <p className="text-xs text-red-500">{errors.adminPassword.message}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Link href="/admin/tenants">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button className="bg-violet-600 hover:bg-violet-700" onClick={onSubmit} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Tenant & Schema
        </Button>
      </div>
    </div>
  );
}
