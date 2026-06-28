'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, AlertTriangle, FileText } from 'lucide-react';

interface Doc {
  id: string;
  documentType: string;
  required: boolean;
  received: boolean;
  receivedDate: string | null;
  discrepancy: string | null;
  discrepancyStatus: string | null;
  notes: string | null;
}

const DOC_LABELS: Record<string, string> = {
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  bill_of_lading: 'Bill of Lading',
  certificate_of_origin: 'Certificate of Origin',
  bill_of_exchange: 'Bill of Exchange',
  phytosanitary_certificate: 'Phytosanitary Certificate',
  fumigation_certificate: 'Fumigation Certificate',
  weight_certificate: 'Weight Certificate',
  inspection_certificate: 'Inspection / SGS Certificate',
  form_e: 'Form-E (SBP)',
};

const DISC_COLORS: Record<string, string> = {
  none: 'text-green-600',
  pending: 'text-red-600',
  waived: 'text-amber-600',
  corrected: 'text-blue-600',
};

export function LcDocumentChecklist({ lcId, docs: initial }: { lcId: string; docs: Doc[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [discText, setDiscText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const update = async (docId: string, payload: object) => {
    setLoading(docId);
    try {
      const res = await fetch(`/api/lc/${lcId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setDocs((prev) => prev.map((d) => (d.id === docId ? updated : d)));
      router.refresh();
    } catch {
      toast.error('Failed to update document');
    } finally {
      setLoading(null);
      setEditing(null);
    }
  };

  const received = docs.filter((d) => d.received).length;
  const discrepant = docs.filter((d) => d.discrepancyStatus === 'pending').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Document Checklist
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600 font-medium">{received}/{docs.length} received</span>
            {discrepant > 0 && <span className="text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{discrepant} discrepant</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left px-4 py-2 font-medium text-slate-600">Document</th>
              <th className="text-center px-4 py-2 font-medium text-slate-600">Received</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Discrepancy</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} className={`border-b ${doc.discrepancyStatus === 'pending' ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{DOC_LABELS[doc.documentType] ?? doc.documentType}</p>
                  {!doc.required && <p className="text-xs text-slate-400">Optional</p>}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => update(doc.id, { received: !doc.received })}
                    disabled={loading === doc.id}
                    className="transition-colors"
                  >
                    {doc.received
                      ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      : <Clock className="h-5 w-5 text-slate-300 mx-auto" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {doc.receivedDate ? new Date(doc.receivedDate).toLocaleDateString('en-PK') : '—'}
                </td>
                <td className="px-4 py-3">
                  {editing === doc.id ? (
                    <div className="flex items-center gap-2">
                      <Input className="text-xs h-7 w-48" placeholder="Describe discrepancy…"
                        value={discText} onChange={(e) => setDiscText(e.target.value)} autoFocus />
                      <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700"
                        onClick={() => update(doc.id, { discrepancy: discText, discrepancyStatus: 'pending' })}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div>
                      {doc.discrepancy && (
                        <p className={`text-xs font-medium ${DISC_COLORS[doc.discrepancyStatus ?? 'none']}`}>
                          {doc.discrepancyStatus === 'pending' && <XCircle className="h-3.5 w-3.5 inline mr-1" />}
                          {doc.discrepancy}
                        </p>
                      )}
                      {doc.discrepancyStatus === 'pending' && (
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => update(doc.id, { discrepancyStatus: 'waived' })}
                            className="text-xs text-amber-600 underline">Waive</button>
                          <button onClick={() => update(doc.id, { discrepancyStatus: 'corrected' })}
                            className="text-xs text-blue-600 underline">Mark Corrected</button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!editing && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => { setEditing(doc.id); setDiscText(doc.discrepancy ?? ''); }}>
                      {doc.discrepancy ? 'Edit' : '+ Discrepancy'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
