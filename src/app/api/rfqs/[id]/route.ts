import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { rfqs, rfqSuppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { format } from 'date-fns';

const schema = z.object({
  action: z.enum(['send', 'cancel', 'mark_comparison_done']).optional(),
  validUntil: z.string().optional(),
  incoterms: z.enum(['FOB', 'CFR', 'CIF', 'EXW', 'DDP']).optional(),
  portOfDischarge: z.string().optional(),
  currency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']).optional(),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']).optional(),
  exchangeRate: z.coerce.number().positive().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { action, exchangeRate, ...rest } = parsed.data;
  const tdb = await getTenantDb(session.user.tenantSlug);

  let updates: Record<string, any> = { ...rest };
  if (exchangeRate) updates.exchangeRate = String(exchangeRate);

  if (action === 'send') {
    updates.status = 'sent';
    updates.dateSent = format(new Date(), 'yyyy-MM-dd');
    // Mark all rfqSuppliers sentAt
    await tdb.update(rfqSuppliers)
      .set({ sentAt: new Date() })
      .where(eq(rfqSuppliers.rfqId, id));
  } else if (action === 'cancel') {
    updates.status = 'cancelled';
  } else if (action === 'mark_comparison_done') {
    updates.status = 'comparison_done';
  }

  const [updated] = await tdb.update(rfqs).set(updates).where(eq(rfqs.id, id)).returning();
  return NextResponse.json(updated);
}
