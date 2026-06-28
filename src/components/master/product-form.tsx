'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Package, BarChart2 } from 'lucide-react';
import Link from 'next/link';

const schema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Name required'),
  category: z.enum(['raw_material', 'packing', 'consumable', 'finished_good']),
  hsCode: z.string().optional(),
  uom: z.enum(['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders']),
  purchaseUom: z.enum(['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders']).optional(),
  uomConversion: z.coerce.number().positive().default(1),
  reorderPoint: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  maxStock: z.coerce.number().min(0).default(0),
  storageConditions: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Product {
  id: string; code?: string | null; name: string;
  category?: string | null; hsCode?: string | null;
  uom: string; purchaseUom?: string | null;
  uomConversion?: string | null; reorderPoint?: string | null;
  minStock?: string | null; maxStock?: string | null;
  storageConditions?: string | null;
}

interface HsCodeOption { code: string; description: string }

export function ProductForm({ product, hsCodes }: { product?: Product; hsCodes: HsCodeOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!product;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: product ? {
      code: product.code ?? '',
      name: product.name,
      category: (product.category ?? 'raw_material') as FormData['category'],
      hsCode: product.hsCode ?? '',
      uom: product.uom as FormData['uom'],
      purchaseUom: (product.purchaseUom ?? '') as FormData['purchaseUom'],
      uomConversion: Number(product.uomConversion ?? 1),
      reorderPoint: Number(product.reorderPoint ?? 0),
      minStock: Number(product.minStock ?? 0),
      maxStock: Number(product.maxStock ?? 0),
      storageConditions: product.storageConditions ?? '',
    } : { category: 'raw_material', uom: 'KG', uomConversion: 1, reorderPoint: 0, minStock: 0, maxStock: 0 },
  });

  const uom = watch('uom');

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = isEdit ? `/api/master/products/${product.id}` : '/api/master/products';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed');
      }
      toast.success(isEdit ? 'Product updated' : 'Product created');
      router.push('/master/products');
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/master/products">
          <Button type="button" variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
      </div>

      {/* Core Details */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Product Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Product Code</Label>
            <Input placeholder="Auto-generated if blank" {...register('code')} className="font-mono" />
            <p className="text-xs text-slate-400">e.g. RM-001, PKG-045</p>
          </div>
          <div className="space-y-1.5">
            <Label>Category <span className="text-red-500">*</span></Label>
            <Select
              defaultValue={product?.category ?? 'raw_material'}
              onValueChange={(v) => setValue('category', v as FormData['category'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="raw_material">Raw Material</SelectItem>
                <SelectItem value="packing">Packing Material</SelectItem>
                <SelectItem value="consumable">Consumable</SelectItem>
                <SelectItem value="finished_good">Finished Good</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Product Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Caustic Soda Flakes 99% — Imported" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>HS Code (8-digit)</Label>
            <Input
              placeholder="28151100"
              {...register('hsCode')}
              className="font-mono"
              list="hs-codes"
            />
            <datalist id="hs-codes">
              {hsCodes.map((h) => (
                <option key={h.code} value={h.code}>{h.code} — {h.description}</option>
              ))}
            </datalist>
            <p className="text-xs text-slate-400">Start typing to see HS code suggestions</p>
          </div>
          <div className="space-y-1.5">
            <Label>Storage Conditions</Label>
            <Input placeholder="e.g. Cool & dry, away from moisture" {...register('storageConditions')} />
          </div>
        </CardContent>
      </Card>

      {/* UOM */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Unit of Measure</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Primary UOM <span className="text-red-500">*</span></Label>
            <Select
              defaultValue={product?.uom ?? 'KG'}
              onValueChange={(v) => setValue('uom', v as FormData['uom'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders'].map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Purchase UOM</Label>
            <Select
              defaultValue={product?.purchaseUom ?? ''}
              onValueChange={(v) => setValue('purchaseUom', v as FormData['purchaseUom'])}
            >
              <SelectTrigger><SelectValue placeholder={`Same as ${uom}`} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Same as primary</SelectItem>
                {['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders'].map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Conversion Factor</Label>
            <Input type="number" step="0.00001" {...register('uomConversion')} />
            <p className="text-xs text-slate-400">How many primary UOM = 1 purchase UOM</p>
          </div>
        </CardContent>
      </Card>

      {/* Stock Levels */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Stock Levels</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Reorder Point ({uom})</Label>
            <Input type="number" step="0.001" min={0} {...register('reorderPoint')} />
          </div>
          <div className="space-y-1.5">
            <Label>Minimum Stock ({uom})</Label>
            <Input type="number" step="0.001" min={0} {...register('minStock')} />
          </div>
          <div className="space-y-1.5">
            <Label>Maximum Stock ({uom})</Label>
            <Input type="number" step="0.001" min={0} {...register('maxStock')} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Link href="/master/products">
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
