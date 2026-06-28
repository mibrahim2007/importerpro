import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { letterOfCredits, purchaseOrders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { format } from 'date-fns';

const actionSchema = z.object({
  action: z.enum(['apply', 'open', 'present_documents', 'under_scrutiny', 'accept', 'retire', 'expire', 'cancel']),
  swiftRef: z.string().optional(),
  openingDate: z.string().optional(),
  documentsReceivedDate: z.string().optional(),
  scrutinyStatus: z.enum(['clean', 'discrepant', 'pending']).optional(),
  retiredDate: z.string().optional(),
});

const STATUS_TRANSITIONS: Record<string, { next: string; allowed: string[] }> = {
  apply:              { next: 'applied',              allowed: ['draft'] },
  open:               { next: 'opened',               allowed: ['applied'] },
  present_documents:  { next: 'documents_presented',  allowed: ['opened'] },
  under_scrutiny:     { next: 'under_scrutiny',       allowed: ['documents_presented'] },
  accept:             { next: 'accepted',             allowed: ['under_scrutiny'] },
  retire:             { next: 'retired',              allowed: ['accepted', 'opened'] },
  expire:             { next: 'expired',              allowed: ['opened', 'applied', 'draft'] },
  cancel:             { next: 'cancelled',            allowed: ['draft', 'applied'] },
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [lc] = await tdb.select().from(letterOfCredits).where(eq(letterOfCredits.id, id)).limit(1);
  if (!lc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Status action
  if (body.action) {
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { action, swiftRef, openingDate, documentsReceivedDate, scrutinyStatus, retiredDate } = parsed.data;
    const transition = STATUS_TRANSITIONS[action];
    if (!transition) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (!transition.allowed.includes(lc.status ?? 'draft'))
      return NextResponse.json({ error: `Cannot ${action} an LC with status ${lc.status}` }, { status: 409 });

    const updates: Record<string, any> = { status: transition.next, updatedAt: new Date() };
    if (swiftRef) updates.swiftRef = swiftRef;
    if (openingDate) updates.openingDate = openingDate;
    if (documentsReceivedDate) updates.documentsReceivedDate = documentsReceivedDate;
    if (scrutinyStatus) updates.scrutinyStatus = scrutinyStatus;
    if (retiredDate) updates.retiredDate = retiredDate;
    else if (action === 'retire') updates.retiredDate = format(new Date(), 'yyyy-MM-dd');

    const [updated] = await tdb.update(letterOfCredits).set(updates).where(eq(letterOfCredits.id, id)).returning();

    // Sync PO status
    if (lc.poId) {
      const PO_STATUS: Record<string, string> = {
        opened: 'lc_opened',
        retired: 'fully_received',
      };
      if (PO_STATUS[transition.next]) {
        await tdb.update(purchaseOrders)
          .set({ status: PO_STATUS[transition.next] as any, updatedAt: new Date() })
          .where(eq(purchaseOrders.id, lc.poId));
      }
    }

    return NextResponse.json(updated);
  }

  // Field update (draft only)
  if (!['draft', 'applied'].includes(lc.status ?? ''))
    return NextResponse.json({ error: 'Use amendment for opened LCs' }, { status: 409 });

  const { lcAmount, ...rest } = body;
  const updates: Record<string, any> = { ...rest, updatedAt: new Date() };
  if (lcAmount) updates.lcAmount = String(lcAmount);

  const [updated] = await tdb.update(letterOfCredits).set(updates).where(eq(letterOfCredits.id, id)).returning();
  return NextResponse.json(updated);
}
