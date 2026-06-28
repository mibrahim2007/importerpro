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
  module: z.enum(['indent', 'po', 'payment']),
  name: z.string().min(2),
  conditionField: z.string().optional(),
  conditionOperator: z.string().optional(),
  conditionValue: z.string().optional(),
  approverRole: z.string().min(1),
  sequence: z.coerce.number().int().min(1).default(1),
});

type FormData = z.infer<typeof schema>;

const ROLES = ['tenant_admin', 'procurement_manager', 'finance_manager', 'warehouse_manager'];
const CONDITION_FIELDS = ['totalAmountPkr', 'totalAmountUsd', 'priority', 'supplierCountry'];
const OPERATORS = ['>', '>=', '<', '=', 'always'];

interface Rule { id: string; module: string; name: string; conditionField?: string | null; conditionOperator?: string | null; conditionValue?: string | null; approverRole: string; sequence?: number | null }

interface ApprovalRuleActionsProps {
  mode: 'create' | 'edit';
  rule?: Rule;
}

export function ApprovalRuleActions({ mode, rule }: ApprovalRuleActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: mode === 'edit' && rule ? {
      module: rule.module as FormData['module'],
      name: rule.name,
      conditionField: rule.conditionField ?? '',
      conditionOperator: rule.conditionOperator ?? 'always',
      conditionValue: rule.conditionValue ?? '',
      approverRole: rule.approverRole,
      sequence: rule.sequence ?? 1,
    } : { module: 'indent', conditionOperator: 'always', sequence: 1 },
  });

  const conditionOperator = watch('conditionOperator');

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = mode === 'edit' ? `/api/settings/approvals/${rule!.id}` : '/api/settings/approvals';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(mode === 'edit' ? 'Rule updated' : 'Approval rule created');
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast.error('Failed to save rule');
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
        {mode === 'create' ? <><Plus className="h-4 w-4" /> Add Rule</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Approval Rule' : 'Edit Approval Rule'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Module <span className="text-red-500">*</span></Label>
              <Select
                defaultValue={mode === 'edit' ? rule?.module : 'indent'}
                onValueChange={(v) => setValue('module', v as FormData['module'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indent">Purchase Indent</SelectItem>
                  <SelectItem value="po">Purchase Order</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Step # (sequence)</Label>
              <Input type="number" min={1} {...register('sequence')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rule Name <span className="text-red-500">*</span></Label>
            <Input placeholder="Manager approval for high-value POs" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-xs font-medium text-slate-500">Trigger Condition</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Field</Label>
                <Select
                  defaultValue={rule?.conditionField ?? ''}
                  onValueChange={(v) => setValue('conditionField', v)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Operator</Label>
                <Select
                  defaultValue={rule?.conditionOperator ?? 'always'}
                  onValueChange={(v) => setValue('conditionOperator', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Value</Label>
                <Input
                  placeholder="100000"
                  disabled={conditionOperator === 'always'}
                  {...register('conditionValue')}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Approver Role <span className="text-red-500">*</span></Label>
            <Select
              defaultValue={mode === 'edit' ? rule?.approverRole : undefined}
              onValueChange={(v) => setValue('approverRole', v)}
            >
              <SelectTrigger><SelectValue placeholder="Select who must approve" /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.approverRole && <p className="text-xs text-red-500">{errors.approverRole.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={onSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Rule' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
