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
  hsCode: z.string().length(8, 'Must be exactly 8 digits').regex(/^\d+$/, 'Digits only'),
  description: z.string().min(3),
  cdPct: z.coerce.number().min(0).max(100).default(0),
  acdPct: z.coerce.number().min(0).max(100).default(0),
  rdPct: z.coerce.number().min(0).max(100).default(0),
  stPct: z.coerce.number().min(0).max(100).default(17),
  whtPct: z.coerce.number().min(0).max(100).default(4.5),
  atPct: z.coerce.number().min(0).max(100).default(5.5),
});

type FormData = z.infer<typeof schema>;

interface HsCodeActionsProps {
  mode: 'create' | 'edit';
  code?: { id: string; hsCode: string; description: string; cdPct: string | null; acdPct: string | null; rdPct: string | null; stPct: string | null; whtPct: string | null; atPct: string | null };
}

export function HsCodeActions({ mode, code }: HsCodeActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: mode === 'edit' && code ? {
      hsCode: code.hsCode,
      description: code.description,
      cdPct: Number(code.cdPct ?? 0),
      acdPct: Number(code.acdPct ?? 0),
      rdPct: Number(code.rdPct ?? 0),
      stPct: Number(code.stPct ?? 17),
      whtPct: Number(code.whtPct ?? 4.5),
      atPct: Number(code.atPct ?? 5.5),
    } : { cdPct: 0, acdPct: 0, rdPct: 0, stPct: 17, whtPct: 4.5, atPct: 5.5 },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = mode === 'edit' ? `/api/admin/config/hs-codes/${code!.id}` : '/api/admin/config/hs-codes';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(mode === 'edit' ? 'HS Code updated' : 'HS Code created');
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error('Failed to save HS code');
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
        {mode === 'create' ? <><Plus className="h-4 w-4" /> Add HS Code</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add HS Code' : 'Edit HS Code'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>HS Code (8 digits) <span className="text-red-500">*</span></Label>
              <Input className="font-mono" placeholder="28151100" {...register('hsCode')} disabled={mode === 'edit'} />
              {errors.hsCode && <p className="text-xs text-red-500">{errors.hsCode.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>ST % <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.01" {...register('stPct')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Sodium Hydroxide (Caustic Soda)" {...register('description')} />
            {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'CD %', name: 'cdPct' as const },
              { label: 'ACD %', name: 'acdPct' as const },
              { label: 'RD %', name: 'rdPct' as const },
              { label: 'WHT %', name: 'whtPct' as const },
              { label: 'AT % (Sec 148)', name: 'atPct' as const },
            ].map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input type="number" step="0.01" {...register(f.name)} />
              </div>
            ))}
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
