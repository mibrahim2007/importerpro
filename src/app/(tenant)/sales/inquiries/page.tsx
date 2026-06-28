import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesInquiries, customers } from '@/db/schema';
import { desc, eq, count, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { InquiryListClient } from '@/components/sales/inquiry-list-client';

export const revalidate = 0;

export default async function InquiriesPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rows, stats] = await Promise.all([
    tdb.select({
      id: salesInquiries.id, inquiryNo: salesInquiries.inquiryNo,
      date: salesInquiries.date, status: salesInquiries.status,
      receivedVia: salesInquiries.receivedVia, requiredByDate: salesInquiries.requiredByDate,
      linkedQuotationId: salesInquiries.linkedQuotationId, notes: salesInquiries.notes,
      createdAt: salesInquiries.createdAt,
      customerName: customers.name, customerCode: customers.code,
    })
    .from(salesInquiries)
    .leftJoin(customers, eq(customers.id, salesInquiries.customerId))
    .orderBy(desc(salesInquiries.createdAt)),

    tdb.select({ status: salesInquiries.status, cnt: count() })
      .from(salesInquiries)
      .groupBy(salesInquiries.status),
  ]);

  const byStatus = Object.fromEntries(stats.map((s) => [s.status, Number(s.cnt)]));
  const total = rows.length;
  const pipeline = (byStatus['new'] ?? 0) + (byStatus['quoted'] ?? 0);
  const winRate = total > 0
    ? Math.round(((byStatus['won'] ?? 0) / total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sales Inquiries</h1>
          <p className="text-sm text-slate-500">Customer inquiries and pre-quotation leads</p>
        </div>
        <Link href="/sales/inquiries/new">
          <Button className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1.5 h-4 w-4" />New Inquiry</Button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-slate-800' },
          { label: 'In Pipeline', value: pipeline, color: 'text-teal-700' },
          { label: 'Won', value: byStatus['won'] ?? 0, color: 'text-green-600' },
          { label: 'Win Rate', value: `${winRate}%`, color: winRate > 50 ? 'text-green-600' : 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <InquiryListClient rows={rows} />
    </div>
  );
}
