import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { notifications } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  await tdb.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false)));

  return NextResponse.json({ ok: true });
}
