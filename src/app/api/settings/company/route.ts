import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db, getTenantDb } from '@/db';
import { tenants, tenantSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  companyName: z.string().min(2),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  businessAddress: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  // Extended settings saved to tenant_settings KV
  companyWebsite: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankIban: z.string().optional(),
  bankSwiftCode: z.string().optional(),
  fiscalYearStart: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantId || !session.user.tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { companyName, ntn, strn, businessAddress, contactPerson, contactEmail, contactPhone, ...extendedSettings } = parsed.data;

  // Update public tenants record
  await db.update(tenants).set({
    companyName,
    ntn: ntn || undefined,
    strn: strn || undefined,
    businessAddress: businessAddress || undefined,
    contactPerson: contactPerson || undefined,
    contactEmail: contactEmail || undefined,
    contactPhone: contactPhone || undefined,
    updatedAt: new Date(),
  }).where(eq(tenants.id, session.user.tenantId));

  // Save extended settings as K/V in tenant schema
  const tdb = await getTenantDb(session.user.tenantSlug);
  const settingsEntries = Object.entries(extendedSettings).filter(([_, v]) => v !== undefined);
  for (const [key, value] of settingsEntries) {
    await tdb.insert(tenantSettings).values({ key, value: value ?? null })
      .onConflictDoUpdate({ target: tenantSettings.key, set: { value: value ?? null, updatedAt: new Date() } });
  }

  return NextResponse.json({ ok: true });
}
