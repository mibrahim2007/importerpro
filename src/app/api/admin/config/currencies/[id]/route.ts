import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { currencies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2).optional(),
  symbol: z.string().optional(),
  rateToUsd: z.coerce.number().positive().optional(),
  rateToPkr: z.coerce.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [updated] = await db.update(currencies).set({ ...parsed.data, updatedAt: new Date() }).where(eq(currencies.id, id)).returning();
  return NextResponse.json(updated);
}
