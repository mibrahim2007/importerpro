import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hsCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  description: z.string().min(3).optional(),
  cdPct: z.coerce.number().min(0).max(100).optional(),
  acdPct: z.coerce.number().min(0).max(100).optional(),
  rdPct: z.coerce.number().min(0).max(100).optional(),
  stPct: z.coerce.number().min(0).max(100).optional(),
  whtPct: z.coerce.number().min(0).max(100).optional(),
  atPct: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db.update(hsCodes).set(parsed.data).where(eq(hsCodes.id, id)).returning();
  return NextResponse.json(updated);
}
