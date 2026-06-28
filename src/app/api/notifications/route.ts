import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { notifications } from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') ?? 'all'; // all | unread | critical
  const limit = parseInt(searchParams.get('limit') ?? '30');

  const conditions = [eq(notifications.userId, session.user.id)];
  if (filter === 'unread') conditions.push(eq(notifications.isRead, false));
  if (filter === 'critical') conditions.push(eq(notifications.priority, 'critical'));

  const [rows, [{ unread }]] = await Promise.all([
    tdb.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(limit),
    tdb.select({ unread: sql<number>`COUNT(*)::int` }).from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false))),
  ]);

  return NextResponse.json({ notifications: rows, unreadCount: unread ?? 0 });
}
