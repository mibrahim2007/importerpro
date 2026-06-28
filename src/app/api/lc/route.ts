import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { letterOfCredits, lcDocuments, purchaseOrders } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const DEFAULT_DOCS = [
  'commercial_invoice',
  'packing_list',
  'bill_of_lading',
  'certificate_of_origin',
  'bill_of_exchange',
];

const schema = z.object({
  lcNo: z.string().min(1),
  poId: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  lcType: z.enum(['sight', 'usance_30', 'usance_60', 'usance_90', 'usance_120', 'usance_180']).default('sight'),
  lcAmount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']).default('USD'),
  issuingBank: z.string().min(1),
  advisingBank: z.string().optional(),
  openingDate: z.string().optional(),
  expiryDate: z.string(),
  latestShipDate: z.string().optional(),
  presentationDays: z.coerce.number().int().min(1).max(45).default(21),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  incoterms: z.enum(['FOB', 'CFR', 'CIF', 'EXW', 'DDP']).default('CIF'),
  partialShipment: z.boolean().default(false),
  transhipment: z.boolean().default(false),
  specialTerms: z.string().optional(),
  requiredDocuments: z.array(z.string()).default(DEFAULT_DOCS),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(letterOfCredits).orderBy(desc(letterOfCredits.createdAt)).limit(100);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { requiredDocuments, lcAmount, ...rest } = parsed.data;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [lc] = await tdb.insert(letterOfCredits).values({
    ...rest,
    lcAmount: String(lcAmount),
    createdById: session.user.id,
  }).returning();

  // Seed document checklist
  if (requiredDocuments.length > 0) {
    await tdb.insert(lcDocuments).values(
      requiredDocuments.map((dt) => ({
        lcId: lc.id,
        documentType: dt,
        required: true,
      }))
    );
  }

  // Mark PO as lc_requested
  if (rest.poId) {
    await tdb.update(purchaseOrders)
      .set({ status: 'lc_requested', updatedAt: new Date() })
      .where(eq(purchaseOrders.id, rest.poId));
  }

  return NextResponse.json(lc, { status: 201 });
}
