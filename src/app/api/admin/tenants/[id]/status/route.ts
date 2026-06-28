import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['active', 'suspended', 'trial']),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status, reason } = parsed.data;

  const [current] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db
    .update(tenants)
    .set({
      status,
      suspendedReason: status === 'suspended' ? reason : null,
      suspendedAt: status === 'suspended' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id))
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    userId: session.user.id,
    userEmail: session.user.email,
    action: status === 'suspended' ? 'SUSPEND_TENANT' : 'REACTIVATE_TENANT',
    resourceType: 'tenant',
    resourceId: id,
    oldValue: current.status,
    newValue: status,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(updated);
}
