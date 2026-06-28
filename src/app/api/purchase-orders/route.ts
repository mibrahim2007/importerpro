import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { purchaseOrders, poLines, rfqs, indents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { format } from 'date-fns';

const lineSchema = z.object({
  productId: z.string().uuid(),
  hsCode: z.string().optional(),
  qty: z.coerce.number().positive(),
  uom: z.string().optional(),
  unitPrice: z.coerce.number().positive(),
  sortOrder: z.number().int().default(0),
});

const schema = z.object({
  supplierId: z.string().uuid(),
  rfqId: z.string().uuid().optional(),
  indentId: z.string().uuid().optional(),
  poDate: z.string(),
  incoterms: z.enum(['FOB', 'CFR', 'CIF', 'EXW', 'DDP']).default('CIF'),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']).default('lc_sight'),
  currency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']).default('USD'),
  exchangeRate: z.coerce.number().positive().optional(),
  latestShipDate: z.string().optional(),
  lcExpiryDate: z.string().optional(),
  bankIssuingLc: z.string().optional(),
  freightAmount: z.coerce.number().min(0).default(0),
  insuranceAmount: z.coerce.number().min(0).default(0),
  packingInstructions: z.string().optional(),
  markingInstructions: z.string().optional(),
  specialConditions: z.string().optional(),
  lines: z.array(lineSchema).min(1),
  action: z.enum(['draft', 'confirm']).default('draft'),
});

function generatePoNo(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `PO-${yy}${mm}-${seq}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt)).limit(100);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { lines, action, exchangeRate, freightAmount, insuranceAmount, rfqId, indentId, ...header } = parsed.data;
  const tdb = await getTenantDb(session.user.tenantSlug);

  // Compute amounts
  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const cifValueUsd = subtotal + freightAmount + insuranceAmount;
  const cifValuePkr = exchangeRate ? cifValueUsd * exchangeRate : undefined;

  const [po] = await tdb.insert(purchaseOrders).values({
    poNo: generatePoNo(),
    status: action === 'confirm' ? 'confirmed' : 'draft',
    createdById: session.user.id,
    rfqId,
    indentId,
    exchangeRate: exchangeRate ? String(exchangeRate) : undefined,
    freightAmount: String(freightAmount),
    insuranceAmount: String(insuranceAmount),
    subtotalAmount: String(subtotal.toFixed(4)),
    cifValueUsd: String(cifValueUsd.toFixed(4)),
    cifValuePkr: cifValuePkr ? String(cifValuePkr.toFixed(2)) : undefined,
    ...header,
  }).returning();

  await tdb.insert(poLines).values(
    lines.map((l, i) => ({
      poId: po.id,
      productId: l.productId,
      hsCode: l.hsCode,
      qty: String(l.qty),
      uom: (l.uom as any) ?? undefined,
      unitPrice: String(l.unitPrice),
      totalPrice: String((l.qty * l.unitPrice).toFixed(4)),
      sortOrder: l.sortOrder ?? i,
    }))
  );

  // Update RFQ status
  if (rfqId) {
    await tdb.update(rfqs).set({ status: 'po_created' }).where(eq(rfqs.id, rfqId));
  }
  // Update indent status
  if (indentId) {
    await tdb.update(indents).set({ status: 'po_confirmed', updatedAt: new Date() }).where(eq(indents.id, indentId));
  }

  return NextResponse.json(po, { status: 201 });
}
