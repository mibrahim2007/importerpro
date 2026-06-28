import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import { notificationPreferences } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form';
import { ALERT_TYPES } from '@/app/api/notifications/preferences/route';

export const revalidate = 0;

export default async function NotificationPreferencesPage() {
  const session = await auth();
  if (!session?.user?.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const saved = await tdb
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.user.id));

  const savedMap = Object.fromEntries(saved.map(r => [r.alertType, r.enabled]));
  const prefs = ALERT_TYPES.map(a => ({
    alertType: a.type,
    label: a.label,
    priority: a.priority,
    category: a.category,
    enabled: savedMap[a.type] !== undefined ? (savedMap[a.type] as boolean) : true,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Notification Preferences</h1>
        <p className="text-sm text-slate-500 mt-1">Choose which alerts you receive. Disabled alerts will not appear in your notification bell or inbox.</p>
      </div>
      <NotificationPreferencesForm prefs={prefs} />
    </div>
  );
}
