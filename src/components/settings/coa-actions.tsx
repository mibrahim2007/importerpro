'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2 } from 'lucide-react';

const schema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense']),
  parentCode: z.string().optional(),
  isGroup: z.boolean().default(false),
  currency: z.string().default('PKR'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Account { id: string; code: string; name: string; accountType: string; parentCode?: string | null; isGroup?: boolean | null; currency?: string | null; notes?: string | null }

interface CoaActionsProps {
  mode: 'create' | 'edit';
  account?: Account;
}

export function CoaActions({ mode, account }: CoaActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: mode === 'edit' && account ? {
      code: account.code,
      name: account.name,
      accountType: account.accountType as FormData['accountType'],
      parentCode: account.parentCode ?? '',
      isGroup: account.isGroup ?? false,
      currency: account.currency ?? 'PKR',
      notes: account.notes ?? '',
    } : { accountType: 'asset', currency: 'PKR', isGroup: false },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = mode === 'edit' ? `/api/settings/coa/${account!.id}` : '/api/settings/coa';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(mode === 'edit' ? 'Account updated' : 'Account created');
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error('Failed to save');
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
          : 'inline-flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors'}
      >
        {mode === 'create' ? <><Plus className="h-4 w-4" /> Add Account</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add GL Account' : 'Edit GL Account'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account Code <span className="text-red-500">*</span></Label>
              <Input className="font-mono" placeholder="5305" {...register('code')} disabled={mode === 'edit'} />
              {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type <span className="text-red-500">*</span></Label>
              <Select
                defaultValue={mode === 'edit' ? account?.accountType : 'asset'}
                onValueChange={(v) => setValue('accountType', v as FormData['accountType'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense'].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Account Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Demurrage Charges" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Parent Code</Label>
              <Input className="font-mono" placeholder="5300" {...register('parentCode')} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select defaultValue={mode === 'edit' ? (account?.currency ?? 'PKR') : 'PKR'} onValueChange={(v) => setValue('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['PKR', 'USD', 'EUR', 'CNY', 'AED', 'GBP'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isGroup" className="rounded" {...register('isGroup')} />
            <label htmlFor="isGroup" className="text-sm text-slate-700">Group account (no direct postings)</label>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional internal note" {...register('notes')} />
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
