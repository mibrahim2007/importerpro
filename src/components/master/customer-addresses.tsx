'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, MapPin, Star, Loader2, Trash2 } from 'lucide-react';

interface Address { id: string; label?: string | null; address: string; city?: string | null; isDefault?: boolean | null }

export function CustomerAddresses({ customerId, addresses: initial }: { customerId: string; addresses: Address[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ label: '', address: '', city: '' });

  const add = async () => {
    if (!form.address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/master/customers/${customerId}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, isDefault: addresses.length === 0 }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setAddresses((prev) => [...prev, created]);
      setForm({ label: '', address: '', city: '' });
      setAdding(false);
      router.refresh();
    } catch {
      toast.error('Failed to add address');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Delivery Addresses</CardTitle>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Address
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {addresses.length === 0 && !adding && (
          <p className="text-sm text-slate-400 italic">No delivery addresses. Add one for dispatch documents.</p>
        )}
        {addresses.map((addr) => (
          <div key={addr.id} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50">
            <MapPin className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-2 mb-0.5">
                {addr.label && <span className="font-medium text-slate-700">{addr.label}</span>}
                {addr.isDefault && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" /> Default
                  </span>
                )}
              </div>
              <p className="text-slate-600">{addr.address}</p>
              {addr.city && <p className="text-slate-400 text-xs">{addr.city}</p>}
            </div>
          </div>
        ))}

        {adding && (
          <div className="p-3 border rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  placeholder="Factory, Head Office, Godown…"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input
                  placeholder="Lahore"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Full Address <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Plot 5, Industrial Estate, Main GT Road"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={add} disabled={loading || !form.address}>
                {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save Address
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
