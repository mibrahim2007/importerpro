import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { shippingLines } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2).optional(),
  scac: z.string().optional(),
  freeDays: z.coerce.number().int().min(0).optional(),
  detentionFreeDays: z.coerce.number().int().min(0).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  website: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const [updated] = await db.update(shippingLines).set(data).where(eq(shippingLines.id, id)).returning();
  return NextResponse.json(updated);
}
