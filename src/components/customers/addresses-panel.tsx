'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, MapPin } from 'lucide-react';

interface Address { id: string; label: string | null; address: string; city: string | null; isDefault: boolean | null }
interface Props { customerId: string; addresses: Address[] }

const BLANK = { label: '', address: '', city: '', isDefault: false };

export function AddressesPanel({ customerId, addresses: initial }: Props) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.address.trim()) return toast.error('Address required');
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_address', ...form }),
      });
      if (!res.ok) throw new Error('Failed');
      const newAddr = await res.json();
      setAddresses((prev) => [...prev, newAddr]);
      setForm(BLANK); setAdding(false);
      router.refresh();
    } catch { toast.error('Failed to add address'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (addressId: string) => {
    if (!confirm('Remove this address?')) return;
    await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_address', addressId }),
    });
    setAddresses((prev) => prev.filter((a) => a.id !== addressId));
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">{addresses.length} Ship-to Address{addresses.length !== 1 ? 'es' : ''}</h2>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setAdding(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Add Address
        </Button>
      </div>

      {adding && (
        <Card className="border-teal-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Ship-to Address</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[['Label (e.g. Factory Gate)', 'label'], ['City', 'city']].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <input value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Full Address *</label>
              <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="rounded" />
              <label htmlFor="isDefault" className="text-sm text-slate-600">Set as default ship-to</label>
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {addresses.map((a) => (
          <Card key={a.id} className={a.isDefault ? 'border-teal-200' : ''}>
            <CardContent className="p-4 flex items-start gap-3">
              <MapPin className={`h-5 w-5 mt-0.5 shrink-0 ${a.isDefault ? 'text-teal-600' : 'text-slate-300'}`} />
              <div className="flex-1">
                {a.label && <p className="font-medium text-slate-800 text-sm">{a.label}</p>}
                <p className="text-sm text-slate-600">{a.address}</p>
                {a.city && <p className="text-xs text-slate-400">{a.city}</p>}
                {a.isDefault && <span className="text-xs text-teal-600 font-medium">Default</span>}
              </div>
              <button onClick={() => handleDelete(a.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </CardContent>
          </Card>
        ))}
        {addresses.length === 0 && !adding && (
          <p className="col-span-2 text-center py-10 text-slate-400 text-sm">No addresses yet.</p>
        )}
      </div>
    </div>
  );
}
