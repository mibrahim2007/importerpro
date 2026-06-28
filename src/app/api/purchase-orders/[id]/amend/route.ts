import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { purchaseOrders, poAmendments } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  fieldChanged: z.string().min(1),
  oldValue: z.string().optional(),
  newValue: z.string().min(1),
  reason: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [po] = await tdb.select({ status: purchaseOrders.status })
    .from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (po.status === 'draft') return NextResponse.json({ error: 'Use edit for draft POs' }, { status: 409 });

  const existingCount = await tdb.$count(poAmendments, eq(poAmendments.poId, id));

  const [amendment] = await tdb.insert(poAmendments).values({
    poId: id,
    amendmentNo: existingCount + 1,
    fieldChanged: parsed.data.fieldChanged,
    oldValue: parsed.data.oldValue,
    newValue: parsed.data.newValue,
    reason: parsed.data.reason,
    createdById: session.user.id,
  }).returning();

  // Apply the field change to the PO
  await tdb.update(purchaseOrders)
    .set({ [parsed.data.fieldChanged]: parsed.data.newValue, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, id));

  return NextResponse.json(amendment, { status: 201 });
}
