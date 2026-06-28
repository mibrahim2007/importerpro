import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { lcDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { format } from 'date-fns';

const schema = z.object({
  received: z.boolean().optional(),
  receivedDate: z.string().optional(),
  discrepancy: z.string().optional(),
  discrepancyStatus: z.enum(['none', 'pending', 'waived', 'corrected']).optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { docId } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const updates: Record<string, any> = { ...parsed.data };
  if (parsed.data.received && !parsed.data.receivedDate) {
    updates.receivedDate = format(new Date(), 'yyyy-MM-dd');
  }

  const [updated] = await tdb.update(lcDocuments).set(updates).where(eq(lcDocuments.id, docId)).returning();
  return NextResponse.json(updated);
}
