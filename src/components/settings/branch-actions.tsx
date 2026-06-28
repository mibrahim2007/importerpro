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
  name: z.string().min(1, 'Required'),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface BranchActionsProps {
  mode: 'create' | 'edit';
  branch?: { id: string; name: string; address?: string | null; city?: string | null; phone?: string | null };
}

export function BranchActions({ mode, branch }: BranchActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: mode === 'edit' && branch ? {
      name: branch.name,
      address: branch.address ?? '',
      city: branch.city ?? '',
      phone: branch.phone ?? '',
    } : {},
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = mode === 'edit' ? `/api/settings/branches/${branch!.id}` : '/api/settings/branches';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(mode === 'edit' ? 'Branch updated' : 'Branch created');
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error('Failed to save branch');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        onClick={() => setOpen(true)}
        className={mode === 'create'
          ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors'
          : 'inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors'}
      >
        {mode === 'create' ? <><Plus className="h-4 w-4" /> Add Branch</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Branch' : 'Edit Branch'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Branch Name <span className="text-red-500">*</span></Label>
            <Input placeholder="Head Office — Karachi" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input placeholder="Plot 12, SITE Industrial Area" {...register('address')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input placeholder="Karachi" {...register('city')} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+92 21 111 111 111" {...register('phone')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={onSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
