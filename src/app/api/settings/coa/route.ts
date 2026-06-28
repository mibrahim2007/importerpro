import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { chartOfAccounts } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense']),
  parentCode: z.string().optional(),
  isGroup: z.boolean().default(false),
  currency: z.string().default('PKR'),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [created] = await tdb.insert(chartOfAccounts).values(parsed.data).returning();
  return NextResponse.json(created, { status: 201 });
}
