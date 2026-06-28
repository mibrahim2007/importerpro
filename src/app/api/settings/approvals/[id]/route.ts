import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { approvalRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2).optional(),
  conditionField: z.string().optional(),
  conditionOperator: z.string().optional(),
  conditionValue: z.string().optional(),
  approverRole: z.string().optional(),
  sequence: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [updated] = await tdb.update(approvalRules).set(parsed.data).where(eq(approvalRules.id, id)).returning();
  return NextResponse.json(updated);
}
