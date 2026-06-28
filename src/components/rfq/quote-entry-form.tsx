'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Star } from 'lucide-react';

interface LineData {
  id: string;
  productName: string;
  qty: string;
  uom: string;
  specGrade: string;
  targetPrice?: string | null;
  existing?: {
    unitPrice: string;
    leadTimeDays?: number | null;
    portOfLoading?: string | null;
    specialTerms?: string | null;
    isRecommended?: boolean | null;
    recommendationNote?: string | null;
    validityDate?: string | null;
    currency?: string | null;
  };
}

interface QuoteLine {
  rfqLineId: string;
  unitPrice: string;
  currency: string;
  validityDate: string;
  leadTimeDays: string;
  portOfLoading: string;
  specialTerms: string;
  isRecommended: boolean;
  recommendationNote: string;
}

export function QuoteEntryForm({
  rfqId,
  rfqSupplierId,
  currency,
  lines,
}: {
  rfqId: string;
  rfqSupplierId: string;
  currency: string;
  lines: LineData[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>(
    lines.map((l) => ({
      rfqLineId: l.id,
      unitPrice: l.existing?.unitPrice ?? '',
      currency: l.existing?.currency ?? currency,
      validityDate: l.existing?.validityDate ?? '',
      leadTimeDays: l.existing?.leadTimeDays ? String(l.existing.leadTimeDays) : '',
      portOfLoading: l.existing?.portOfLoading ?? '',
      specialTerms: l.existing?.specialTerms ?? '',
      isRecommended: l.existing?.isRecommended ?? false,
      recommendationNote: l.existing?.recommendationNote ?? '',
    }))
  );

  const update = (i: number, field: keyof QuoteLine, val: any) =>
    setQuoteLines((prev) => prev.map((q, idx) => (idx === i ? { ...q, [field]: val } : q)));

  const submit = async () => {
    const filled = quoteLines.filter((q) => q.unitPrice);
    if (filled.length === 0) { toast.error('Enter at least one price'); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqSupplierId,
          quotes: filled.map((q) => ({
            rfqLineId: q.rfqLineId,
            unitPrice: Number(q.unitPrice),
            currency: q.currency,
            validityDate: q.validityDate || undefined,
            leadTimeDays: q.leadTimeDays ? Number(q.leadTimeDays) : undefined,
            portOfLoading: q.portOfLoading || undefined,
            specialTerms: q.specialTerms || undefined,
            isRecommended: q.isRecommended,
            recommendationNote: q.recommendationNote || undefined,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      toast.success('Quotes saved');
      router.push(`/import/rfqs/${rfqId}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {lines.map((line, i) => (
        <Card key={line.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800">
                {line.productName}
                {line.specGrade && <span className="ml-2 text-xs font-normal text-slate-400">{line.specGrade}</span>}
              </CardTitle>
              <div className="text-xs text-slate-500">
                {Number(line.qty).toLocaleString()} {line.uom}
                {line.targetPrice && (
                  <span className="ml-2 text-slate-400">Target: ${Number(line.targetPrice).toFixed(2)}</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Price ({currency}) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={quoteLines[i].unitPrice}
                onChange={(e) => update(i, 'unitPrice', e.target.value)}
                className={line.targetPrice && quoteLines[i].unitPrice &&
                  Number(quoteLines[i].unitPrice) > Number(line.targetPrice)
                  ? 'border-red-300 focus:ring-red-300' : ''}
              />
              {line.targetPrice && quoteLines[i].unitPrice &&
                Number(quoteLines[i].unitPrice) > Number(line.targetPrice) && (
                  <p className="text-xs text-red-500">Above target price</p>
                )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Validity Date</Label>
              <Input
                type="date"
                value={quoteLines[i].validityDate}
                onChange={(e) => update(i, 'validityDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Time (days)</Label>
              <Input
                type="number"
                placeholder="45"
                value={quoteLines[i].leadTimeDays}
                onChange={(e) => update(i, 'leadTimeDays', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port of Loading</Label>
              <Input
                placeholder="Shanghai / Guangzhou"
                value={quoteLines[i].portOfLoading}
                onChange={(e) => update(i, 'portOfLoading', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Special Terms / Notes</Label>
              <Input
                placeholder="Payment: 50% advance, 50% on BL…"
                value={quoteLines[i].specialTerms}
                onChange={(e) => update(i, 'specialTerms', e.target.value)}
              />
            </div>
            <div className="col-span-2 flex items-start gap-3">
              <button
                type="button"
                onClick={() => update(i, 'isRecommended', !quoteLines[i].isRecommended)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  quoteLines[i].isRecommended
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Star className={`h-4 w-4 ${quoteLines[i].isRecommended ? 'fill-amber-400 stroke-amber-400' : ''}`} />
                Recommend this quote
              </button>
              {quoteLines[i].isRecommended && (
                <Input
                  className="flex-1"
                  placeholder="Reason for recommendation…"
                  value={quoteLines[i].recommendationNote}
                  onChange={(e) => update(i, 'recommendationNote', e.target.value)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save Quotes
        </Button>
      </div>
    </div>
  );
}
