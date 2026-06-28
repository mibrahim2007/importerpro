import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { approvalRules } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  module: z.enum(['indent', 'po', 'payment']),
  name: z.string().min(2),
  conditionField: z.string().optional(),
  conditionOperator: z.string().optional(),
  conditionValue: z.string().optional(),
  approverRole: z.string().min(1),
  sequence: z.coerce.number().int().min(1).default(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [created] = await tdb.insert(approvalRules).values(parsed.data).returning();
  return NextResponse.json(created, { status: 201 });
}
