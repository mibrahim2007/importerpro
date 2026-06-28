import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { indents, indentLines } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { format } from 'date-fns';

const lineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().positive(),
  uom: z.string(),
  estPriceUsd: z.coerce.number().optional(),
  specifications: z.string().optional(),
  originCountry: z.string().optional(),
});

const createIndentSchema = z.object({
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'urgent', 'critical']).default('normal'),
  requiredBy: z.string().optional(),
  justification: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
  action: z.enum(['draft', 'submit']).default('draft'),
});

function generateIndentNo(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mmdd = format(now, 'MMdd');
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `PR-${yyyy}-${mmdd}-${seq}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb
    .select()
    .from(indents)
    .orderBy(desc(indents.createdAt))
    .limit(100);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createIndentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lines, action, ...headerData } = parsed.data;
  const status = action === 'submit' ? 'submitted' : 'draft';

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [indent] = await tdb
    .insert(indents)
    .values({
      indentNo: generateIndentNo(),
      date: format(new Date(), 'yyyy-MM-dd'),
      status,
      requesterId: session.user.id,
      branchId: headerData.branchId,
      warehouseId: headerData.warehouseId,
      priority: headerData.priority,
      requiredBy: headerData.requiredBy,
      justification: headerData.justification,
      notes: headerData.notes,
    })
    .returning();

  await tdb.insert(indentLines).values(
    lines.map((line, i) => ({
      indentId: indent.id,
      productId: line.productId,
      qty: String(line.qty),
      uom: line.uom as any,
      estPriceUsd: line.estPriceUsd ? String(line.estPriceUsd) : undefined,
      specifications: line.specifications,
      originCountry: line.originCountry,
      sortOrder: i,
    }))
  );

  return NextResponse.json(indent, { status: 201 });
}
