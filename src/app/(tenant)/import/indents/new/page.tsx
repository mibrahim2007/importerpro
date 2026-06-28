'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const lineSchema = z.object({
  productId: z.string().min(1, 'Product required'),
  qty: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive('Must be positive')),
  uom: z.string().min(1),
  estPriceUsd: z.union([z.string(), z.number(), z.undefined()]).transform((v) => (v === '' || v === undefined ? undefined : Number(v))).optional(),
  specifications: z.string().optional(),
  originCountry: z.string().optional(),
});

const indentSchema = z.object({
  branchId: z.string().min(1, 'Branch required'),
  warehouseId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'urgent', 'critical']),
  requiredBy: z.string().optional(),
  justification: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line item required'),
});

type IndentFormInput = z.input<typeof indentSchema>;
type IndentFormOutput = z.output<typeof indentSchema>;

const UOM_OPTIONS = ['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders'];

export default function NewIndentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<IndentFormInput, unknown, IndentFormOutput>({
    resolver: zodResolver(indentSchema) as any,
    defaultValues: {
      priority: 'normal',
      lines: [{ productId: '', qty: 1, uom: 'KG' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const saveIndent = async (data: IndentFormOutput, action: 'draft' | 'submit') => {
    const res = await fetch('/api/indents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, action }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const onSaveDraft = handleSubmit(async (data: IndentFormOutput) => {
    setSaving(true);
    try {
      await saveIndent(data, 'draft');
      toast.success('Indent saved as draft');
      router.push('/import/indents');
    } catch {
      toast.error('Failed to save indent');
    } finally {
      setSaving(false);
    }
  });

  const onSubmitForApproval = handleSubmit(async (data: IndentFormOutput) => {
    setSubmitting(true);
    try {
      await saveIndent(data, 'submit');
      toast.success('Indent submitted for approval');
      router.push('/import/indents');
    } catch {
      toast.error('Failed to submit indent');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/import/indents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">New Indent</h1>
          <p className="text-sm text-slate-500">Purchase Requisition — auto-numbered on save</p>
        </div>
      </div>

      {/* Header Fields */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Requisition Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Branch <span className="text-red-500">*</span></Label>
            <Select onValueChange={(v) => setValue('branchId', v as string)}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_placeholder" disabled>No branches configured yet</SelectItem>
              </SelectContent>
            </Select>
            {errors.branchId && <p className="text-xs text-red-500">{errors.branchId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Destination Warehouse</Label>
            <Select onValueChange={(v) => setValue('warehouseId', v as string)}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_placeholder" disabled>No warehouses configured yet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Priority <span className="text-red-500">*</span></Label>
            <Select defaultValue="normal" onValueChange={(v) => setValue('priority', v as IndentFormInput['priority'] & string)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Required By Date</Label>
            <Input type="date" {...register('requiredBy')} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Justification</Label>
            <Textarea placeholder="Business reason for this requisition..." rows={2} {...register('justification')} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Line Items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ productId: '', qty: 1, uom: 'KG' })}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="border rounded-lg p-4 space-y-3 relative">
              <div className="absolute top-3 right-3">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Line {index + 1}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Product <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(v) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setValue(`lines.${index}.productId` as any, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_placeholder" disabled>No products configured yet</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.lines?.[index]?.productId && (
                    <p className="text-xs text-red-500">{errors.lines[index].productId?.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Quantity <span className="text-red-500">*</span></Label>
                  <Input type="number" step="0.001" placeholder="0.000" {...register(`lines.${index}.qty`)} />
                  {errors.lines?.[index]?.qty && (
                    <p className="text-xs text-red-500">{errors.lines[index].qty?.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">UOM <span className="text-red-500">*</span></Label>
                  <Select defaultValue="KG" onValueChange={(v) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setValue(`lines.${index}.uom` as any, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UOM_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Est. Unit Price (USD)</Label>
                  <Input type="number" step="0.0001" placeholder="0.00" {...register(`lines.${index}.estPriceUsd`)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Country of Origin (pref.)</Label>
                  <Input placeholder="e.g. China" {...register(`lines.${index}.originCountry`)} />
                </div>

                <div className="space-y-1.5 sm:col-span-3">
                  <Label className="text-xs">Specifications / Grade</Label>
                  <Input placeholder="Technical specs, grade, purity, etc." {...register(`lines.${index}.specifications`)} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-1.5">
            <Label>Internal Notes</Label>
            <Textarea placeholder="Additional notes (internal only)..." rows={2} {...register('notes')} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Link href="/import/indents">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button variant="outline" onClick={onSaveDraft} disabled={saving || submitting}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save as Draft
        </Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={onSubmitForApproval} disabled={saving || submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}
