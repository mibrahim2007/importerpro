import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hsCodes } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  hsCode: z.string().length(8).regex(/^\d+$/),
  description: z.string().min(3),
  cdPct: z.coerce.number().min(0).max(100).default(0),
  acdPct: z.coerce.number().min(0).max(100).default(0),
  rdPct: z.coerce.number().min(0).max(100).default(0),
  stPct: z.coerce.number().min(0).max(100).default(17),
  whtPct: z.coerce.number().min(0).max(100).default(4.5),
  atPct: z.coerce.number().min(0).max(100).default(5.5),
});

async function checkAdmin() {
  const session = await auth();
  if (!session?.user.isSuperAdmin) throw new Response('Forbidden', { status: 403 });
  return session;
}

export async function GET() {
  await checkAdmin();
  const all = await db.select().from(hsCodes);
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  try { await checkAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [created] = await db.insert(hsCodes).values(parsed.data).returning();
  return NextResponse.json(created, { status: 201 });
}
