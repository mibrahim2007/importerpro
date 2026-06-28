import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { getTenantDb } from '@/db';
import { notifications } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) redirect('/login');
  if (session.user.isSuperAdmin) redirect('/admin');

  let unreadCount = 0;
  try {
    const tdb = await getTenantDb(session.user.tenantSlug!);
    const [{ count }] = await tdb
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false)));
    unreadCount = count ?? 0;
  } catch { /* no-op if tenant schema not provisioned yet */ }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userName={session.user.name ?? session.user.email ?? 'User'}
        userEmail={session.user.email ?? ''}
        notificationCount={unreadCount}
      />
      <Sidebar />
      <main className="ml-60 mt-14 p-6 min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
