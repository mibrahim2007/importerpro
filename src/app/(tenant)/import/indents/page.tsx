import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { indents, indentLines, products, branches } from '@/db/schema';
import { eq, desc, count, and, inArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ChevronRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rfq_created: 'bg-teal-100 text-teal-700',
  po_confirmed: 'bg-indigo-100 text-indigo-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400',
  closed: 'bg-slate-100 text-slate-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  normal: 'text-slate-600',
  urgent: 'text-amber-600 font-semibold',
  critical: 'text-red-600 font-bold',
};

export default async function IndentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { status: filterStatus } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  // Status counts for summary cards
  const statusCounts = await tdb
    .select({ status: indents.status, count: count() })
    .from(indents)
    .groupBy(indents.status);

  const countMap = Object.fromEntries(statusCounts.map((r) => [r.status, r.count]));

  // Main query with optional status filter
  let query = tdb
    .select({
      indent: indents,
      branch: branches,
      lineCount: sql<number>`count(${indentLines.id})`,
    })
    .from(indents)
    .leftJoin(branches, eq(indents.branchId, branches.id))
    .leftJoin(indentLines, eq(indentLines.indentId, indents.id))
    .groupBy(indents.id, branches.id)
    .orderBy(desc(indents.createdAt))
    .limit(100)
    .$dynamic();

  if (filterStatus) {
    query = query.where(eq(indents.status, filterStatus as any));
  }

  const rows = await query;

  const summaryCards = [
    { label: 'Draft', status: 'draft', count: countMap['draft'] ?? 0, color: 'text-slate-600' },
    { label: 'Pending Approval', status: 'submitted', count: (countMap['submitted'] ?? 0) + (countMap['under_review'] ?? 0), color: 'text-amber-600' },
    { label: 'Approved', status: 'approved', count: countMap['approved'] ?? 0, color: 'text-green-600' },
    { label: 'RFQ Created', status: 'rfq_created', count: countMap['rfq_created'] ?? 0, color: 'text-teal-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Indents</h1>
          <p className="text-sm text-slate-500 mt-0.5">Purchase Requisitions</p>
        </div>
        <Link href="/import/indents/new">
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-1.5" /> New Indent
          </Button>
        </Link>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((s) => (
          <Link key={s.label} href={filterStatus === s.status ? '/import/indents' : `/import/indents?status=${s.status}`}>
            <Card className={`text-center py-3 cursor-pointer transition-all ${filterStatus === s.status ? 'ring-2 ring-teal-500' : 'hover:shadow-sm'}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Indent No</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Branch</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Lines</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Required By</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Priority</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      {filterStatus ? `No ${filterStatus} indents.` : (
                        <>No indents yet. <Link href="/import/indents/new" className="text-teal-600 hover:underline">Create your first indent →</Link></>
                      )}
                    </td>
                  </tr>
                ) : (
                  rows.map(({ indent, branch, lineCount }) => (
                    <tr key={indent.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{indent.indentNo}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {indent.date ? new Date(indent.date).toLocaleDateString('en-PK') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{branch?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{Number(lineCount)} item{Number(lineCount) !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {indent.requiredBy ? new Date(indent.requiredBy).toLocaleDateString('en-PK') : '—'}
                      </td>
                      <td className={`px-4 py-3 capitalize text-xs ${PRIORITY_COLORS[indent.priority ?? 'normal']}`}>
                        {indent.priority ?? 'normal'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[indent.status ?? 'draft']}`}>
                          {(indent.status ?? 'draft').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/import/indents/${indent.id}`}>
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
