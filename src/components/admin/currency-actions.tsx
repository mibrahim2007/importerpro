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
  code: z.string().length(3, 'Must be 3 letters (ISO 4217)').toUpperCase(),
  name: z.string().min(2),
  symbol: z.string().optional(),
  rateToUsd: z.coerce.number().positive(),
  rateToPkr: z.coerce.number().positive(),
});

type FormData = z.infer<typeof schema>;

interface CurrencyActionsProps {
  mode: 'create' | 'edit';
  currency?: { id: string; code: string; name: string; symbol?: string | null; rateToUsd: string | null; rateToPkr: string | null };
}

export function CurrencyActions({ mode, currency }: CurrencyActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: mode === 'edit' && currency ? {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol ?? '',
      rateToUsd: Number(currency.rateToUsd ?? 1),
      rateToPkr: Number(currency.rateToPkr ?? 280),
    } : {},
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = mode === 'edit' ? `/api/admin/config/currencies/${currency!.id}` : '/api/admin/config/currencies';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(mode === 'edit' ? 'Currency updated' : 'Currency added');
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error('Failed to save currency');
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
        {mode === 'create' ? <><Plus className="h-4 w-4" /> Add Currency</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Currency' : 'Update Rate'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Code (ISO 4217) <span className="text-red-500">*</span></Label>
              <Input className="font-mono uppercase" placeholder="USD" maxLength={3} {...register('code')} disabled={mode === 'edit'} />
              {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Symbol</Label>
              <Input placeholder="$" {...register('symbol')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Currency Name <span className="text-red-500">*</span></Label>
            <Input placeholder="US Dollar" {...register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rate to USD <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.0001" placeholder="1.0" {...register('rateToUsd')} />
            </div>
            <div className="space-y-1.5">
              <Label>Rate to PKR <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.01" placeholder="280.00" {...register('rateToPkr')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={onSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Add' : 'Update'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
