import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { lcCharges } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  chargeType: z.enum([
    'opening_commission', 'swift', 'handling', 'amendment',
    'acceptance', 'retirement', 'discrepancy_fee', 'other',
  ]),
  description: z.string().optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().default('PKR'),
  chargedDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(lcCharges).where(eq(lcCharges.lcId, id)).orderBy(desc(lcCharges.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [charge] = await tdb.insert(lcCharges).values({
    lcId: id,
    ...parsed.data,
    amount: String(parsed.data.amount),
  }).returning();
  return NextResponse.json(charge, { status: 201 });
}
