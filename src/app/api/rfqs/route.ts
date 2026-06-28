import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { rfqs, rfqLines, rfqSuppliers, indents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { format } from 'date-fns';

const lineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().positive(),
  uom: z.string().optional(),
  specGrade: z.string().optional(),
  targetPrice: z.coerce.number().optional(),
  sortOrder: z.number().int().default(0),
});

const schema = z.object({
  indentId: z.string().uuid().optional(),
  validUntil: z.string().optional(),
  incoterms: z.enum(['FOB', 'CFR', 'CIF', 'EXW', 'DDP']).default('CIF'),
  portOfDischarge: z.string().optional(),
  currency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']).default('USD'),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']).optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  supplierIds: z.array(z.string().uuid()).min(1),
  lines: z.array(lineSchema).min(1),
  action: z.enum(['draft', 'send']).default('draft'),
});

function generateRfqNo(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `RFQ-${yy}${mm}-${seq}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(100);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { lines, supplierIds, action, indentId, exchangeRate, ...header } = parsed.data;
  const status = action === 'send' ? 'sent' : 'draft';
  const dateSent = action === 'send' ? format(new Date(), 'yyyy-MM-dd') : undefined;

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [rfq] = await tdb.insert(rfqs).values({
    rfqNo: generateRfqNo(),
    indentId,
    dateSent,
    status,
    createdById: session.user.id,
    exchangeRate: exchangeRate ? String(exchangeRate) : undefined,
    ...header,
  }).returning();

  await tdb.insert(rfqLines).values(
    lines.map((l, i) => ({
      rfqId: rfq.id,
      productId: l.productId,
      qty: String(l.qty),
      uom: (l.uom as any) ?? undefined,
      specGrade: l.specGrade,
      targetPrice: l.targetPrice ? String(l.targetPrice) : undefined,
      sortOrder: l.sortOrder ?? i,
    }))
  );

  await tdb.insert(rfqSuppliers).values(
    supplierIds.map((supplierId) => ({
      rfqId: rfq.id,
      supplierId,
      sentAt: action === 'send' ? new Date() : undefined,
      status: action === 'send' ? 'pending' : 'pending',
    }))
  );

  // Mark indent as rfq_created
  if (indentId) {
    await tdb.update(indents)
      .set({ status: 'rfq_created', updatedAt: new Date() })
      .where(eq(indents.id, indentId));
  }

  return NextResponse.json(rfq, { status: 201 });
}
