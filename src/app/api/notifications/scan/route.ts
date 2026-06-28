import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { runAlertScan } from '@/lib/notifications/alert-scanner';

export async function POST() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const created = await runAlertScan(tdb, session.user.id);

  return NextResponse.json({ created });
}
