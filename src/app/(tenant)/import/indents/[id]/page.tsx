import { auth } from '@/lib/auth/config';
import { getTenantDb, db } from '@/db';
import { indents, indentLines, products, branches, users, tenantUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, MapPin, User, AlertTriangle, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';
import { IndentActions } from '@/components/indents/indent-actions';
import { IndentTimeline } from '@/components/indents/indent-timeline';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rfq_created: 'bg-teal-100 text-teal-700',
  po_confirmed: 'bg-indigo-100 text-indigo-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400',
  closed: 'bg-slate-100 text-slate-500',
};

const PRIORITY_BADGES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-slate-100 text-slate-600',
  urgent: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

export default async function IndentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug || !session.user.tenantId) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  // Fetch indent with lines and products
  const [indent] = await tdb.select().from(indents).where(eq(indents.id, id)).limit(1);
  if (!indent) notFound();

  const [lines, branch] = await Promise.all([
    tdb.select({ line: indentLines, product: products })
      .from(indentLines)
      .leftJoin(products, eq(indentLines.productId, products.id))
      .where(eq(indentLines.indentId, id))
      .orderBy(indentLines.sortOrder),
    tdb.select().from(branches).where(eq(branches.id, indent.branchId)).limit(1),
  ]);

  // Fetch requester name from public schema
  const [requester] = await db.select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, indent.requesterId))
    .limit(1);

  let approver = null;
  if (indent.approvedById) {
    [approver] = await db.select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, indent.approvedById))
      .limit(1);
  }

  // Determine what actions the current user can take
  const role = session.user.role ?? '';
  const isRequester = session.user.id === indent.requesterId;
  const canApprove = ['tenant_admin', 'procurement_manager'].includes(role);
  const canSubmit = isRequester && indent.status === 'draft';
  const canApproveOrReject = canApprove && ['submitted', 'under_review'].includes(indent.status ?? '');
  const canCancel = (isRequester || canApprove) && ['draft', 'submitted', 'under_review'].includes(indent.status ?? '');

  // Est total USD
  const estTotalUsd = lines.reduce((sum, { line }) => sum + Number(line.estPriceUsd ?? 0) * Number(line.qty), 0);

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/import/indents">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-mono font-bold text-slate-900">{indent.indentNo}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[indent.status ?? 'draft']}`}>
                {(indent.status ?? 'draft').replace(/_/g, ' ')}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${PRIORITY_BADGES[indent.priority ?? 'normal']}`}>
                {indent.priority ?? 'normal'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Purchase Requisition</p>
          </div>
        </div>

        {/* Action buttons */}
        <IndentActions
          indentId={id}
          status={indent.status ?? 'draft'}
          canSubmit={canSubmit}
          canApproveOrReject={canApproveOrReject}
          canCancel={canCancel}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Info cards */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Requisition Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Date</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {indent.date ? new Date(indent.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Required By</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {indent.requiredBy ? new Date(indent.requiredBy).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not specified'}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Branch</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {branch[0]?.name ?? '—'}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Requester</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {requester?.name ?? requester?.email ?? '—'}
                </p>
              </div>
              {indent.justification && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Justification</p>
                  <p className="text-slate-700">{indent.justification}</p>
                </div>
              )}
              {indent.notes && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Notes</p>
                  <p className="text-slate-600 italic">{indent.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rejection reason */}
          {indent.status === 'rejected' && indent.rejectedReason && (
            <div className="flex gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Rejection Reason</p>
                <p className="text-sm text-red-600 mt-0.5">{indent.rejectedReason}</p>
              </div>
            </div>
          )}

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Line Items ({lines.length})</CardTitle>
                {estTotalUsd > 0 && (
                  <span className="text-sm font-semibold text-slate-900">
                    Est. Total: <span className="text-teal-700">USD {estTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">#</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Product</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">HS Code</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Qty</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">UOM</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Est. Price/Unit (USD)</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-600">Est. Total (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ line, product }, i) => (
                    <tr key={line.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{product?.name ?? line.productId}</p>
                          {product?.code && <p className="text-xs text-slate-400 font-mono">{product.code}</p>}
                          {line.specifications && <p className="text-xs text-slate-500 mt-0.5">{line.specifications}</p>}
                          {line.originCountry && <p className="text-xs text-slate-400">Origin: {line.originCountry}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{product?.hsCode ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{Number(line.qty).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{line.uom ?? product?.uom ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {line.estPriceUsd ? `$${Number(line.estPriceUsd).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {line.estPriceUsd
                          ? `$${(Number(line.estPriceUsd) * Number(line.qty)).toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Right — timeline + approval info */}
        <div className="space-y-4">
          <IndentTimeline
            status={indent.status ?? 'draft'}
            createdAt={indent.createdAt?.toISOString() ?? null}
            approvedAt={indent.approvedAt?.toISOString() ?? null}
            approver={approver}
            rejectedReason={indent.rejectedReason ?? null}
          />

          {indent.status === 'approved' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-green-700">Approved</p>
                  {approver && <p className="text-green-600 text-xs mt-0.5">by {approver.name ?? approver.email}</p>}
                  {indent.approvedAt && (
                    <p className="text-green-500 text-xs">
                      {new Date(indent.approvedAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                    </p>
                  )}
                  <div className="mt-3">
                    <Link href={`/import/indents/${id}/rfq/new`}>
                      <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700">
                        <FileText className="h-4 w-4 mr-1.5" />
                        Create RFQ
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {indent.status === 'submitted' && canApproveOrReject && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This indent is awaiting your approval. Use the actions above to approve or reject.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
