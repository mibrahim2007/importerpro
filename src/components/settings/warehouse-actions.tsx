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
import { Plus, Pencil, Loader2, MapPin } from 'lucide-react';

const warehouseSchema = z.object({
  branchId: z.string().min(1, 'Select a branch'),
  name: z.string().min(1, 'Required'),
  address: z.string().optional(),
  city: z.string().optional(),
});

const locationSchema = z.object({
  name: z.string().min(1, 'Required'),
  locationType: z.enum(['bin', 'rack', 'row', 'shelf', 'zone', 'yard']),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;
type LocationFormData = z.infer<typeof locationSchema>;

interface Branch { id: string; name: string }
interface Warehouse { id: string; branchId: string; name: string; address?: string | null; city?: string | null }

type WarehouseActionsProps =
  | { mode: 'create'; branches: Branch[]; warehouse?: undefined; warehouseId?: undefined }
  | { mode: 'edit'; branches: Branch[]; warehouse: Warehouse; warehouseId?: undefined }
  | { mode: 'add-location'; warehouseId: string; branches: Branch[]; warehouse?: undefined };

export function WarehouseActions(props: WarehouseActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const warehouseForm = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema) as any,
    defaultValues: props.mode === 'edit' ? {
      branchId: props.warehouse.branchId,
      name: props.warehouse.name,
      address: props.warehouse.address ?? '',
      city: props.warehouse.city ?? '',
    } : {},
  });

  const locationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema) as any,
    defaultValues: { locationType: 'bin' },
  });

  const handleWarehouseSubmit = warehouseForm.handleSubmit(async (data) => {
    setLoading(true);
    try {
      const url = props.mode === 'edit' ? `/api/settings/warehouses/${props.warehouse.id}` : '/api/settings/warehouses';
      const res = await fetch(url, {
        method: props.mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(props.mode === 'edit' ? 'Warehouse updated' : 'Warehouse created');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Failed');
    } finally {
      setLoading(false);
    }
  });

  const handleLocationSubmit = locationForm.handleSubmit(async (data) => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/stock-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, warehouseId: props.warehouseId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Location added');
      setOpen(false);
      locationForm.reset({ locationType: 'bin' });
      router.refresh();
    } catch {
      toast.error('Failed');
    } finally {
      setLoading(false);
    }
  });

  if (props.mode === 'add-location') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
          <Plus className="h-3.5 w-3.5" /> Add Location
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Stock Location</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Location Name <span className="text-red-500">*</span></Label>
              <Input placeholder="A-01-01 (Rack A, Row 1, Shelf 1)" {...locationForm.register('name')} />
              {locationForm.formState.errors.name && <p className="text-xs text-red-500">{locationForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select defaultValue="bin" onValueChange={(v) => locationForm.setValue('locationType', v as LocationFormData['locationType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['bin', 'rack', 'row', 'shelf', 'zone', 'yard'].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleLocationSubmit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        onClick={() => setOpen(true)}
        className={props.mode === 'create'
          ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors'
          : 'inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors'}
      >
        {props.mode === 'create' ? <><Plus className="h-4 w-4" /> Add Warehouse</> : <Pencil className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{props.mode === 'create' ? 'Add Warehouse' : 'Edit Warehouse'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Branch <span className="text-red-500">*</span></Label>
            <Select
              defaultValue={props.mode === 'edit' ? props.warehouse.branchId : undefined}
              onValueChange={(v) => warehouseForm.setValue('branchId', v)}
            >
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {props.branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {warehouseForm.formState.errors.branchId && <p className="text-xs text-red-500">{warehouseForm.formState.errors.branchId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Warehouse Name <span className="text-red-500">*</span></Label>
            <Input placeholder="Main Warehouse — Korangi" {...warehouseForm.register('name')} />
            {warehouseForm.formState.errors.name && <p className="text-xs text-red-500">{warehouseForm.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Plot 12, Block A" {...warehouseForm.register('address')} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input placeholder="Karachi" {...warehouseForm.register('city')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleWarehouseSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {props.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
