import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { rfqs, rfqLines, rfqSuppliers, indents } from '@/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, ChevronRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  quotes_received: 'bg-amber-100 text-amber-700',
  comparison_done: 'bg-indigo-100 text-indigo-700',
  po_created: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

export default async function RfqsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const statusCounts = await tdb
    .select({ status: rfqs.status, count: count() })
    .from(rfqs).groupBy(rfqs.status);
  const countMap = Object.fromEntries(statusCounts.map((r) => [r.status, r.count]));

  const rows = await tdb
    .select({
      rfq: rfqs,
      indent: { indentNo: indents.indentNo },
      supplierCount: sql<number>`count(distinct ${rfqSuppliers.id})`,
      lineCount: sql<number>`count(distinct ${rfqLines.id})`,
    })
    .from(rfqs)
    .leftJoin(indents, eq(rfqs.indentId, indents.id))
    .leftJoin(rfqSuppliers, eq(rfqSuppliers.rfqId, rfqs.id))
    .leftJoin(rfqLines, eq(rfqLines.rfqId, rfqs.id))
    .groupBy(rfqs.id, indents.indentNo)
    .orderBy(desc(rfqs.createdAt))
    .limit(100);

  const summaryCards = [
    { label: 'Draft', status: 'draft', count: countMap['draft'] ?? 0, color: 'text-slate-600' },
    { label: 'Sent', status: 'sent', count: countMap['sent'] ?? 0, color: 'text-blue-600' },
    { label: 'Quotes In', status: 'quotes_received', count: countMap['quotes_received'] ?? 0, color: 'text-amber-600' },
    { label: 'PO Created', status: 'po_created', count: countMap['po_created'] ?? 0, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">RFQs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Request for Quotations</p>
        </div>
        <Link href="/import/rfqs/new">
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-1.5" /> New RFQ
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((s) => (
          <Card key={s.label} className="text-center py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">RFQ No</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Indent</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Date Sent</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Valid Until</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Incoterms</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Lines</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Suppliers</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No RFQs yet. Create one from an{' '}
                      <Link href="/import/indents?status=approved" className="text-teal-600 hover:underline">
                        approved indent →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  rows.map(({ rfq, indent, supplierCount, lineCount }) => (
                    <tr key={rfq.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{rfq.rfqNo}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">{indent?.indentNo ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {rfq.dateSent ? new Date(rfq.dateSent).toLocaleDateString('en-PK') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {rfq.validUntil ? new Date(rfq.validUntil).toLocaleDateString('en-PK') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{rfq.incoterms ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{Number(lineCount)}</td>
                      <td className="px-4 py-3 text-slate-500">{Number(supplierCount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[rfq.status ?? 'draft']}`}>
                          {(rfq.status ?? 'draft').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/import/rfqs/${rfq.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
