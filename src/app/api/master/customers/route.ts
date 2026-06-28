import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { customers } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  customerType: z.enum(['manufacturer', 'trader', 'distributor', 'retailer', 'government']).default('manufacturer'),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  cnic: z.string().optional(),
  fbrStatus: z.enum(['active', 'non_filer', 'exempt']).default('active'),
  billingAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']).default('net_30'),
  creditLimitPkr: z.coerce.number().min(0).default(0),
  salesTaxCategory: z.enum(['registered', 'unregistered', 'exempt']).default('registered'),
  whtRatePct: z.coerce.number().min(0).max(100).default(4.5),
  preferredPaymentMode: z.string().default('cheque'),
  bankName: z.string().optional(),
  openingBalance: z.coerce.number().default(0),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  let { code, email, ...rest } = parsed.data;

  if (!code) {
    const count = await tdb.$count(customers);
    code = `CUS-${String(count + 1).padStart(4, '0')}`;
  }

  const [created] = await tdb.insert(customers).values({ code, email: email || undefined, ...rest }).returning();
  return NextResponse.json(created, { status: 201 });
}
