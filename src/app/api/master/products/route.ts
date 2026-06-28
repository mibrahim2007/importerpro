import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { products } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  category: z.enum(['raw_material', 'packing', 'consumable', 'finished_good']).default('raw_material'),
  hsCode: z.string().optional(),
  uom: z.enum(['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders']).default('KG'),
  purchaseUom: z.enum(['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders']).optional(),
  uomConversion: z.coerce.number().positive().default(1),
  reorderPoint: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  maxStock: z.coerce.number().min(0).default(0),
  storageConditions: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  return NextResponse.json(await tdb.select().from(products));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Auto-generate code if blank
  let { code, ...rest } = parsed.data;
  if (!code) {
    const prefix = rest.category === 'raw_material' ? 'RM' : rest.category === 'packing' ? 'PKG' : rest.category === 'consumable' ? 'CON' : 'FG';
    const count = await tdb.$count(products);
    code = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  const [created] = await tdb.insert(products).values({ code, ...rest }).returning();
  return NextResponse.json(created, { status: 201 });
}
