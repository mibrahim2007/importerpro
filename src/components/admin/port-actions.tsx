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
  type: z.enum(['sea', 'air', 'dry', 'land']),
  city: z.string().optional(),
  country: z.string().default('PK'),
});

type FormData = z.infer<typeof schema>;

interface PortActionsProps {
  mode: 'create' | 'edit';
  port?: { id: string; code: string; name: string; type: string; city?: string | null; country?: string | null };
}

export function PortActions({ mode, port }: PortActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: mode === 'edit' && port ? {
      code: port.code,
      name: port.name,
      type: port.type as FormData['type'],
      city: port.city ?? '',
      country: port.country ?? 'PK',
    } : { type: 'sea', country: 'PK' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = mode === 'edit' ? `/api/admin/config/ports/${port!.id}` : '/api/admin/config/ports';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(mode === 'edit' ? 'Port updated' : 'Port created');
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error('Failed to save port');
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
        {mode === 'create' ? <><Plus className="h-4 w-4" /> Add Port</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Port' : 'Edit Port'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Code <span className="text-red-500">*</span></Label>
              <Input className="font-mono" placeholder="PKKHI" {...register('code')} disabled={mode === 'edit'} />
              {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type <span className="text-red-500">*</span></Label>
              <Select defaultValue={mode === 'edit' ? port?.type : 'sea'} onValueChange={(v) => setValue('type', v as FormData['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sea">Sea</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="dry">Dry Port</SelectItem>
                  <SelectItem value="land">Land Border</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input placeholder="Karachi Port Trust (KPT)" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input placeholder="Karachi" {...register('city')} />
            </div>
            <div className="space-y-1.5">
              <Label>Country Code</Label>
              <Input placeholder="PK" {...register('country')} maxLength={2} className="uppercase" />
            </div>
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
