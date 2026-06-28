import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { letterOfCredits, lcAmendments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  fieldChanged: z.string().min(1),
  oldValue: z.string().optional(),
  newValue: z.string().min(1),
  reason: z.string().min(1),
  approvedDate: z.string().optional(),
});

// Allowed fields to amend on an open LC
const AMENDABLE_FIELDS = ['expiry_date', 'latest_ship_date', 'lc_amount', 'special_terms', 'port_of_loading', 'port_of_discharge'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [lc] = await tdb.select().from(letterOfCredits).where(eq(letterOfCredits.id, id)).limit(1);
  if (!lc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existingCount = await tdb.$count(lcAmendments, eq(lcAmendments.lcId, id));

  const [amendment] = await tdb.insert(lcAmendments).values({
    lcId: id,
    amendmentNo: existingCount + 1,
    ...parsed.data,
    createdById: session.user.id,
  }).returning();

  // Apply the change to the LC record
  const fieldMap: Record<string, string> = {
    expiry_date: 'expiryDate',
    latest_ship_date: 'latestShipDate',
    lc_amount: 'lcAmount',
    special_terms: 'specialTerms',
    port_of_loading: 'portOfLoading',
    port_of_discharge: 'portOfDischarge',
  };
  const drizzleField = fieldMap[parsed.data.fieldChanged];
  if (drizzleField) {
    await tdb.update(letterOfCredits)
      .set({ [drizzleField]: parsed.data.newValue, updatedAt: new Date() })
      .where(eq(letterOfCredits.id, id));
  }

  return NextResponse.json(amendment, { status: 201 });
}
