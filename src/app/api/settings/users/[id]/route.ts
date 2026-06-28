import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenantUsers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  role: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantId || session.user.role !== 'tenant_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify the tenantUser belongs to this tenant
  const [tu] = await db.select().from(tenantUsers)
    .where(and(eq(tenantUsers.id, id), eq(tenantUsers.tenantId, session.user.tenantId)))
    .limit(1);

  if (!tu) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [updated] = await db.update(tenantUsers).set(parsed.data).where(eq(tenantUsers.id, id)).returning();
  return NextResponse.json(updated);
}
