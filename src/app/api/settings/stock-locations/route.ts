import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { stockLocations } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  warehouseId: z.string().uuid(),
  name: z.string().min(1),
  locationType: z.enum(['bin', 'rack', 'row', 'shelf', 'zone', 'yard']),
  parentId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [created] = await tdb.insert(stockLocations).values(parsed.data).returning();
  return NextResponse.json(created, { status: 201 });
}
