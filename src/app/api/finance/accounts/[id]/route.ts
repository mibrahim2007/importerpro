import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { chartOfAccounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [updated] = await tdb.update(chartOfAccounts)
    .set({ ...body, updatedAt: undefined })
    .where(eq(chartOfAccounts.id, id))
    .returning();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ account: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [existing] = await tdb.select({ isSystem: chartOfAccounts.isSystem })
    .from(chartOfAccounts).where(eq(chartOfAccounts.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.isSystem) return NextResponse.json({ error: 'System accounts cannot be deleted' }, { status: 400 });
  await tdb.delete(chartOfAccounts).where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.isSystem, false)));
  return NextResponse.json({ ok: true });
}
