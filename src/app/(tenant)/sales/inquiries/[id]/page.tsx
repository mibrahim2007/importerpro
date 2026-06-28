import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesInquiries, salesInquiryLines, customers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus } from 'lucide-react';
import { InquiryActions } from '@/components/sales/inquiry-actions';

export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', quoted: 'bg-teal-100 text-teal-700',
  won: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
};
const VIA_LABEL: Record<string, string> = {
  phone: 'Phone Call', whatsapp: 'WhatsApp', email: 'Email', visit: 'In-Person Visit',
};

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[inquiry], lines] = await Promise.all([
    tdb.select({
      id: salesInquiries.id, inquiryNo: salesInquiries.inquiryNo,
      date: salesInquiries.date, status: salesInquiries.status,
      receivedVia: salesInquiries.receivedVia, requiredByDate: salesInquiries.requiredByDate,
      notes: salesInquiries.notes, lossReason: salesInquiries.lossReason,
      linkedQuotationId: salesInquiries.linkedQuotationId, createdAt: salesInquiries.createdAt,
      customerId: salesInquiries.customerId,
      customerName: customers.name, customerCode: customers.code, customerPhone: customers.phone,
    })
    .from(salesInquiries)
    .leftJoin(customers, eq(customers.id, salesInquiries.customerId))
    .where(eq(salesInquiries.id, id)).limit(1),

    tdb.select({
      id: salesInquiryLines.id, productId: salesInquiryLines.productId,
      tentativeQty: salesInquiryLines.tentativeQty, uom: salesInquiryLines.uom,
      targetPricePkr: salesInquiryLines.targetPricePkr, notes: salesInquiryLines.notes,
      productName: products.name, productCode: products.code,
    })
    .from(salesInquiryLines)
    .leftJoin(products, eq(products.id, salesInquiryLines.productId))
    .where(eq(salesInquiryLines.inquiryId, id))
    .orderBy(salesInquiryLines.sortOrder),
  ]);

  if (!inquiry) notFound();

  const canQuote = inquiry.status === 'new' || inquiry.status === 'quoted';

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start gap-3">
        <Link href="/sales/inquiries"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{inquiry.inquiryNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[inquiry.status ?? ''] ?? ''}`}>
              {inquiry.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {inquiry.customerName} · {VIA_LABEL[inquiry.receivedVia ?? ''] ?? inquiry.receivedVia} · {inquiry.date}
          </p>
        </div>
        <div className="flex gap-2">
          {canQuote && (
            <Link href={`/sales/quotations/new?inquiryId=${inquiry.id}&customerId=${inquiry.customerId}`}>
              <Button className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1.5 h-4 w-4" />Create Quotation</Button>
            </Link>
          )}
          {inquiry.linkedQuotationId && (
            <Link href={`/sales/quotations/${inquiry.linkedQuotationId}`}>
              <Button variant="outline">View Quotation →</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Products Inquired</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {['Product', 'Tentative Qty', 'Customer Target Price', 'Notes'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{l.productName ?? '—'}</p>
                        {l.productCode && <p className="text-xs text-slate-400">{l.productCode}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.tentativeQty ? `${l.tentativeQty} ${l.uom ?? ''}` : '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {l.targetPricePkr ? `PKR ${parseFloat(l.targetPricePkr).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{l.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {inquiry.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600">{inquiry.notes}</p></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Inquiry Info</p>
              {[
                { label: 'Inquiry No', value: inquiry.inquiryNo },
                { label: 'Date', value: inquiry.date },
                { label: 'Required By', value: inquiry.requiredByDate ?? '—' },
                { label: 'Channel', value: VIA_LABEL[inquiry.receivedVia ?? ''] ?? '—' },
                { label: 'Customer', value: inquiry.customerName ?? '—' },
                { label: 'Phone', value: inquiry.customerPhone ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
              {inquiry.lossReason && (
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-red-400">Loss Reason: {inquiry.lossReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <InquiryActions inquiryId={inquiry.id} status={inquiry.status ?? 'new'} />
        </div>
      </div>
    </div>
  );
}
