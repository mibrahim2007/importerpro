import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { shippingLines } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2),
  scac: z.string().optional(),
  freeDays: z.coerce.number().int().min(0).default(14),
  detentionFreeDays: z.coerce.number().int().min(0).default(14),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  website: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const [created] = await db.insert(shippingLines).values(data).returning();
  return NextResponse.json(created, { status: 201 });
}
