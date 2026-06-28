import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { currencies } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  code: z.string().length(3).toUpperCase(),
  name: z.string().min(2),
  symbol: z.string().optional(),
  rateToUsd: z.coerce.number().positive(),
  rateToPkr: z.coerce.number().positive(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [created] = await db.insert(currencies).values(parsed.data).returning();
  return NextResponse.json(created, { status: 201 });
}
