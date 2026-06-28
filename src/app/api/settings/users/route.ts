import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, tenantUsers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantId || session.user.role !== 'tenant_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, password, role } = parsed.data;

  // Check if already in this tenant
  const existing = await db.select({ u: users, tu: tenantUsers })
    .from(users)
    .leftJoin(tenantUsers, and(eq(tenantUsers.userId, users.id), eq(tenantUsers.tenantId, session.user.tenantId)))
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0 && existing[0].tu) {
    return NextResponse.json({ error: 'User already in this workspace' }, { status: 409 });
  }

  let userId: string;

  if (existing.length > 0) {
    // User exists in system — just link them
    userId = existing[0].u.id;
  } else {
    // Create new user
    const passwordHash = await bcrypt.hash(password, 12);
    const [newUser] = await db.insert(users).values({ email, name, passwordHash }).returning();
    userId = newUser.id;
  }

  await db.insert(tenantUsers).values({
    tenantId: session.user.tenantId,
    userId,
    role,
    isActive: true,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
