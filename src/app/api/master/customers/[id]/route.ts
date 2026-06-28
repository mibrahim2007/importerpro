import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).optional(),
  customerType: z.enum(['manufacturer', 'trader', 'distributor', 'retailer', 'government']).optional(),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  cnic: z.string().optional(),
  fbrStatus: z.enum(['active', 'non_filer', 'exempt']).optional(),
  billingAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']).optional(),
  creditLimitPkr: z.coerce.number().min(0).optional(),
  salesTaxCategory: z.enum(['registered', 'unregistered', 'exempt']).optional(),
  whtRatePct: z.coerce.number().min(0).max(100).optional(),
  preferredPaymentMode: z.string().optional(),
  bankName: z.string().optional(),
  openingBalance: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { email, ...rest } = parsed.data;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [updated] = await tdb.update(customers).set({ email: email || undefined, ...rest }).where(eq(customers.id, id)).returning();
  return NextResponse.json(updated);
}
