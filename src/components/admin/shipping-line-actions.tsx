'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2 } from 'lucide-react';

const schema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2),
  scac: z.string().optional(),
  freeDays: z.coerce.number().int().min(0).default(14),
  detentionFreeDays: z.coerce.number().int().min(0).default(14),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  website: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ShippingLineActionsProps {
  mode: 'create' | 'edit';
  line?: { id: string; code: string; name: string; scac?: string | null; freeDays?: number | null; detentionFreeDays?: number | null; contactEmail?: string | null; contactPhone?: string | null; website?: string | null };
}

export function ShippingLineActions({ mode, line }: ShippingLineActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: mode === 'edit' && line ? {
      code: line.code,
      name: line.name,
      scac: line.scac ?? '',
      freeDays: line.freeDays ?? 14,
      detentionFreeDays: line.detentionFreeDays ?? 14,
      contactEmail: line.contactEmail ?? '',
      contactPhone: line.contactPhone ?? '',
      website: line.website ?? '',
    } : { freeDays: 14, detentionFreeDays: 14 },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = mode === 'edit' ? `/api/admin/config/shipping-lines/${line!.id}` : '/api/admin/config/shipping-lines';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(mode === 'edit' ? 'Shipping line updated' : 'Shipping line created');
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error('Failed to save shipping line');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        onClick={() => setOpen(true)}
        className={mode === 'create'
          ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors'
          : 'inline-flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors'}
      >
        {mode === 'create' ? <><Plus className="h-4 w-4" /> Add Line</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Shipping Line' : 'Edit Shipping Line'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Code <span className="text-red-500">*</span></Label>
              <Input className="font-mono" placeholder="MAERSK" {...register('code')} disabled={mode === 'edit'} />
              {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>SCAC Code</Label>
              <Input className="font-mono" placeholder="MAEU" {...register('scac')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input placeholder="Maersk Line" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Free Days (Demurrage)</Label>
              <Input type="number" min={0} {...register('freeDays')} />
            </div>
            <div className="space-y-1.5">
              <Label>Free Days (Detention)</Label>
              <Input type="number" min={0} {...register('detentionFreeDays')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input type="email" placeholder="pk@maersk.com" {...register('contactEmail')} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input placeholder="+92 21 111 111 111" {...register('contactPhone')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input placeholder="https://www.maersk.com" {...register('website')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={onSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
