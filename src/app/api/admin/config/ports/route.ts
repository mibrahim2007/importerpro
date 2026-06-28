import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ports } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2),
  type: z.enum(['sea', 'air', 'dry', 'land']),
  city: z.string().optional(),
  country: z.string().default('PK'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [created] = await db.insert(ports).values(parsed.data).returning();
  return NextResponse.json(created, { status: 201 });
}
