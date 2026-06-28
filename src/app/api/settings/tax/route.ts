import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { tenantSettings } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  standardSalesTaxRate: z.coerce.number().min(0).max(100),
  enhancedSalesTaxRate: z.coerce.number().min(0).max(100),
  whtOnGoods: z.coerce.number().min(0).max(100),
  whtOnServices: z.coerce.number().min(0).max(100),
  whtOnContractors: z.coerce.number().min(0).max(100),
  advanceIncomeTax: z.coerce.number().min(0).max(100),
  additionalSalesTaxOnImport: z.coerce.number().min(0).max(100),
  corporateTaxRate: z.coerce.number().min(0).max(100),
  superTaxRate: z.coerce.number().min(0).max(100),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  // Upsert each setting as a K/V pair
  for (const [key, value] of Object.entries(parsed.data)) {
    await tdb.insert(tenantSettings).values({ key: `tax.${key}`, value: String(value) })
      .onConflictDoUpdate({ target: tenantSettings.key, set: { value: String(value), updatedAt: new Date() } });
  }

  return NextResponse.json({ ok: true });
}
