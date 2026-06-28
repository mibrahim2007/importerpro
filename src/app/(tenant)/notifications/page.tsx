import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { notifications } from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { NotificationsInbox } from '@/components/notifications/notifications-inbox';

export const revalidate = 0;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { filter = 'all' } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const conditions = [eq(notifications.userId, session.user.id)];
  if (filter === 'unread') conditions.push(eq(notifications.isRead, false));
  if (filter === 'critical') conditions.push(eq(notifications.priority, 'critical'));

  const [rows, [{ unread }]] = await Promise.all([
    tdb.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(100),
    tdb.select({ unread: sql<number>`COUNT(*)::int` }).from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false))),
  ]);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500 mt-0.5">{unread ?? 0} unread</p>
      </div>
      <NotificationsInbox
        items={rows.map(r => ({ ...r, createdAt: r.createdAt ? r.createdAt.toISOString() : null }))}
        filter={filter}
        unreadCount={unread ?? 0}
      />
    </div>
  );
}
