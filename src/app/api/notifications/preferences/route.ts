import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { notificationPreferences } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const revalidate = 0;

// All alert types with labels and default priority
export const ALERT_TYPES = [
  { type: 'demurrage_critical',       label: 'Demurrage — Critical (≤3 days)',       priority: 'critical', category: 'Import Ops' },
  { type: 'demurrage_warning',        label: 'Demurrage — Warning (≤7 days)',        priority: 'high',     category: 'Import Ops' },
  { type: 'lc_expiry_critical',       label: 'LC Expiry — Critical (≤7 days)',       priority: 'critical', category: 'Import Ops' },
  { type: 'lc_expiry_warning',        label: 'LC Expiry — Warning (≤15 days)',       priority: 'high',     category: 'Import Ops' },
  { type: 'latest_ship_date_warning', label: 'Latest Ship Date Due (≤7 days)',       priority: 'critical', category: 'Import Ops' },
  { type: 'gd_not_filed',             label: 'GD Not Filed (2+ days after arrival)', priority: 'high',     category: 'Customs' },
  { type: 'examination_today',        label: 'GD Examination Scheduled Today',       priority: 'critical', category: 'Customs' },
  { type: 'indent_pending_approval',  label: 'Indent Pending Approval (>48h)',       priority: 'medium',   category: 'Procurement' },
  { type: 'vendor_bill_overdue',      label: 'Vendor Bill Overdue',                  priority: 'high',     category: 'Finance' },
  { type: 'grn_qc_hold',             label: 'GRN in QC Hold (>3 days)',             priority: 'medium',   category: 'Warehouse' },
] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  const saved = await tdb
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.user.id));

  // Build a complete map: saved rows override the default (enabled=true)
  const savedMap = Object.fromEntries(saved.map(r => [r.alertType, r.enabled]));

  const prefs = ALERT_TYPES.map(a => ({
    alertType: a.type,
    label: a.label,
    priority: a.priority,
    category: a.category,
    enabled: savedMap[a.type] !== undefined ? savedMap[a.type] : true,
  }));

  return NextResponse.json({ preferences: prefs });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { alertType, enabled } = body;

  if (!alertType || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'alertType and enabled are required' }, { status: 400 });
  }
  if (!ALERT_TYPES.find(a => a.type === alertType)) {
    return NextResponse.json({ error: 'Unknown alert type' }, { status: 400 });
  }

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Upsert — update if exists, insert if not
  const existing = await tdb
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, session.user.id),
        eq(notificationPreferences.alertType, alertType),
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await tdb
      .update(notificationPreferences)
      .set({ enabled, updatedAt: new Date() })
      .where(
        and(
          eq(notificationPreferences.userId, session.user.id),
          eq(notificationPreferences.alertType, alertType),
        )
      );
  } else {
    await tdb.insert(notificationPreferences).values({
      userId: session.user.id,
      alertType,
      enabled,
    });
  }

  return NextResponse.json({ alertType, enabled });
}
