import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { chartOfAccounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2).optional(),
  parentCode: z.string().optional(),
  currency: z.string().optional(),
  isGroup: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Prevent editing system accounts' core fields
  const [acct] = await tdb.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, id)).limit(1);
  if (!acct) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await tdb.update(chartOfAccounts).set(parsed.data).where(eq(chartOfAccounts.id, id)).returning();
  return NextResponse.json(updated);
}
