import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { rfqs, rfqSuppliers, supplierQuotes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const quoteLineSchema = z.object({
  rfqLineId: z.string().uuid(),
  unitPrice: z.coerce.number().positive(),
  currency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']).default('USD'),
  validityDate: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(1).optional(),
  portOfLoading: z.string().optional(),
  specialTerms: z.string().optional(),
  isRecommended: z.boolean().default(false),
  recommendationNote: z.string().optional(),
});

const schema = z.object({
  rfqSupplierId: z.string().uuid(),
  quotes: z.array(quoteLineSchema).min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: rfqId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { rfqSupplierId, quotes } = parsed.data;
  const tdb = await getTenantDb(session.user.tenantSlug);

  // Verify rfqSupplier belongs to this RFQ
  const [rfqSupplier] = await tdb.select()
    .from(rfqSuppliers)
    .where(and(eq(rfqSuppliers.id, rfqSupplierId), eq(rfqSuppliers.rfqId, rfqId)))
    .limit(1);
  if (!rfqSupplier) return NextResponse.json({ error: 'Supplier not on this RFQ' }, { status: 404 });

  // Upsert quotes — delete existing then re-insert
  for (const quote of quotes) {
    // Delete existing quote for this supplier+line combination
    const existingQuotes = await tdb.select({ id: supplierQuotes.id })
      .from(supplierQuotes)
      .where(and(
        eq(supplierQuotes.rfqSupplierId, rfqSupplierId),
        eq(supplierQuotes.rfqLineId, quote.rfqLineId)
      ));
    for (const eq_ of existingQuotes) {
      await tdb.delete(supplierQuotes).where(eq(supplierQuotes.id, eq_.id));
    }
  }

  const inserted = await tdb.insert(supplierQuotes).values(
    quotes.map((q) => ({
      rfqSupplierId,
      rfqLineId: q.rfqLineId,
      unitPrice: String(q.unitPrice),
      currency: q.currency,
      validityDate: q.validityDate,
      leadTimeDays: q.leadTimeDays,
      portOfLoading: q.portOfLoading,
      specialTerms: q.specialTerms,
      isRecommended: q.isRecommended,
      recommendationNote: q.recommendationNote,
    }))
  ).returning();

  // Mark rfqSupplier status as 'quoted'
  await tdb.update(rfqSuppliers)
    .set({ status: 'quoted' })
    .where(eq(rfqSuppliers.id, rfqSupplierId));

  // Check if all suppliers have quoted → update rfq status
  const pendingSuppliers = await tdb.select()
    .from(rfqSuppliers)
    .where(and(eq(rfqSuppliers.rfqId, rfqId), eq(rfqSuppliers.status, 'pending')));
  if (pendingSuppliers.length === 0) {
    await tdb.update(rfqs).set({ status: 'quotes_received' }).where(eq(rfqs.id, rfqId));
  }

  return NextResponse.json(inserted, { status: 201 });
}
