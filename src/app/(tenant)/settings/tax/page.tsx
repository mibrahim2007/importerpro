'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Info } from 'lucide-react';

const schema = z.object({
  // FBR Sales Tax
  standardSalesTaxRate: z.coerce.number().min(0).max(100).default(17),
  enhancedSalesTaxRate: z.coerce.number().min(0).max(100).default(18),
  // Withholding Tax
  whtOnGoods: z.coerce.number().min(0).max(100).default(4.5),
  whtOnServices: z.coerce.number().min(0).max(100).default(8),
  whtOnContractors: z.coerce.number().min(0).max(100).default(7.5),
  // Import specific
  advanceIncomeTax: z.coerce.number().min(0).max(100).default(5.5),
  additionalSalesTaxOnImport: z.coerce.number().min(0).max(100).default(3),
  // Company tax
  corporateTaxRate: z.coerce.number().min(0).max(100).default(29),
  superTaxRate: z.coerce.number().min(0).max(100).default(10),
});

type FormData = z.infer<typeof schema>;

const fieldGroups = [
  {
    title: 'FBR Sales Tax (ST)',
    note: 'FBR standard rate is 17% for registered manufacturers',
    fields: [
      { name: 'standardSalesTaxRate' as const, label: 'Standard ST Rate (%)', placeholder: '17' },
      { name: 'enhancedSalesTaxRate' as const, label: 'Enhanced ST Rate (non-filers) (%)', placeholder: '18' },
    ],
  },
  {
    title: 'Withholding Tax (WHT / Section 153)',
    note: 'Applied at source on payments to registered persons',
    fields: [
      { name: 'whtOnGoods' as const, label: 'WHT on Goods (%)', placeholder: '4.5' },
      { name: 'whtOnServices' as const, label: 'WHT on Services (%)', placeholder: '8' },
      { name: 'whtOnContractors' as const, label: 'WHT on Contractors (%)', placeholder: '7.5' },
    ],
  },
  {
    title: 'Import Duties & Taxes',
    note: 'Sec 148 Advance IT and additional ST applicable at import stage',
    fields: [
      { name: 'advanceIncomeTax' as const, label: 'Advance Income Tax — Sec 148 (%)', placeholder: '5.5' },
      { name: 'additionalSalesTaxOnImport' as const, label: 'Additional ST on Import (%)', placeholder: '3' },
    ],
  },
  {
    title: 'Corporate Tax',
    note: 'Company-level rates for financial reporting',
    fields: [
      { name: 'corporateTaxRate' as const, label: 'Corporate Income Tax (%)', placeholder: '29' },
      { name: 'superTaxRate' as const, label: 'Super Tax (high-income cos) (%)', placeholder: '10' },
    ],
  },
];

export default function TaxConfigPage() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      standardSalesTaxRate: 17,
      enhancedSalesTaxRate: 18,
      whtOnGoods: 4.5,
      whtOnServices: 8,
      whtOnContractors: 7.5,
      advanceIncomeTax: 5.5,
      additionalSalesTaxOnImport: 3,
      corporateTaxRate: 29,
      superTaxRate: 10,
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/tax', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Tax configuration saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tax Configuration</h1>
        <p className="text-sm text-slate-500 mt-0.5">FBR default rates — used in duty calculations and document generation</p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex gap-2 text-sm text-blue-700">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>These are tenant-level defaults. HS Code-specific rates from the platform master override these per-item in duty calculations.</span>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {fieldGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{group.title}</CardTitle>
              <p className="text-xs text-slate-400">{group.note}</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.fields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      placeholder={f.placeholder}
                      {...register(f.name)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end pb-4">
          <Button type="submit" disabled={loading || !isDirty} className="bg-teal-600 hover:bg-teal-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Tax Config
          </Button>
        </div>
      </form>
    </div>
  );
}
