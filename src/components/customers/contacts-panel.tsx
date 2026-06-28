'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Phone, Mail, Star } from 'lucide-react';

interface Contact {
  id: string; name: string; designation: string | null; email: string | null;
  phone: string | null; whatsapp: string | null; isPrimary: boolean | null;
}
interface Props { customerId: string; contacts: Contact[] }

const BLANK = { name: '', designation: '', email: '', phone: '', whatsapp: '', isPrimary: false };

export function ContactsPanel({ customerId, contacts: initial }: Props) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);
  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_contact', ...form }),
      });
      if (!res.ok) throw new Error('Failed');
      const newContact = await res.json();
      setContacts((prev) => [...prev, newContact]);
      setForm(BLANK); setAdding(false);
      router.refresh();
    } catch { toast.error('Failed to add contact'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Remove this contact?')) return;
    await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_contact', contactId }),
    });
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">{contacts.length} Contact Person{contacts.length !== 1 ? 's' : ''}</h2>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setAdding(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Add Contact
        </Button>
      </div>

      {adding && (
        <Card className="border-teal-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[['Name *', 'name'], ['Designation', 'designation'], ['Email', 'email'], ['Phone', 'phone'], ['WhatsApp', 'whatsapp']].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <input value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex items-center gap-2 col-span-2">
              <input type="checkbox" id="primary" checked={form.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} className="rounded" />
              <label htmlFor="primary" className="text-sm text-slate-600">Primary contact</label>
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
        {contacts.map((c) => (
          <Card key={c.id} className={c.isPrimary ? 'border-teal-200' : ''}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0 text-sm">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                  {c.isPrimary && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                </div>
                {c.designation && <p className="text-xs text-slate-400">{c.designation}</p>}
                <div className="mt-1.5 space-y-0.5">
                  {c.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</p>}
                  {c.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</p>}
                  {c.whatsapp && <p className="text-xs text-slate-500">WA: {c.whatsapp}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </CardContent>
          </Card>
        ))}
        {contacts.length === 0 && !adding && (
          <p className="col-span-2 text-center py-10 text-slate-400 text-sm">No contacts yet. Add a contact person above.</p>
        )}
      </div>
    </div>
  );
}
