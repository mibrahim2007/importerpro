import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { indents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['submit', 'approve', 'reject', 'cancel', 'review']),
  reason: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { action, reason } = parsed.data;
  const tdb = await getTenantDb(session.user.tenantSlug);

  // Fetch current indent to validate transitions
  const [indent] = await tdb.select({ status: indents.status, requesterId: indents.requesterId })
    .from(indents).where(eq(indents.id, id)).limit(1);
  if (!indent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const role = session.user.role ?? '';
  const isRequester = session.user.id === indent.requesterId;
  const canApprove = ['tenant_admin', 'procurement_manager'].includes(role);

  let updates: Partial<typeof indents.$inferInsert> = {};

  switch (action) {
    case 'submit':
      if (!isRequester) return NextResponse.json({ error: 'Only the requester can submit' }, { status: 403 });
      if (indent.status !== 'draft') return NextResponse.json({ error: 'Only draft indents can be submitted' }, { status: 409 });
      updates = { status: 'submitted' };
      break;

    case 'approve':
      if (!canApprove) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      if (!['submitted', 'under_review'].includes(indent.status ?? ''))
        return NextResponse.json({ error: 'Indent is not pending approval' }, { status: 409 });
      updates = { status: 'approved', approvedById: session.user.id, approvedAt: new Date() };
      break;

    case 'reject':
      if (!canApprove) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      if (!reason?.trim()) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });
      if (!['submitted', 'under_review'].includes(indent.status ?? ''))
        return NextResponse.json({ error: 'Indent is not pending approval' }, { status: 409 });
      updates = { status: 'rejected', rejectedReason: reason };
      break;

    case 'review':
      if (!canApprove) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      if (indent.status !== 'submitted') return NextResponse.json({ error: 'Indent must be submitted first' }, { status: 409 });
      updates = { status: 'under_review' };
      break;

    case 'cancel':
      if (!isRequester && !canApprove) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      if (['approved', 'rfq_created', 'po_confirmed', 'closed', 'rejected', 'cancelled'].includes(indent.status ?? ''))
        return NextResponse.json({ error: 'Indent cannot be cancelled in its current state' }, { status: 409 });
      updates = { status: 'cancelled' };
      break;

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const [updated] = await tdb.update(indents)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(indents.id, id))
    .returning();

  return NextResponse.json(updated);
}
