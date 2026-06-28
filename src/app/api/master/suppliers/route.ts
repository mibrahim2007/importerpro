import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { suppliers } from '@/db/schema';
import { z } from 'zod';

const schema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  country: z.string().optional(),
  supplierType: z.enum(['manufacturer', 'trader', 'clearing_agent', 'freight_forwarder', 'shipping_line', 'port_agent']).default('manufacturer'),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankSwift: z.string().optional(),
  bankCurrency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']).default('USD'),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']).default('lc_sight'),
  preferredIncoterms: z.enum(['FOB', 'CFR', 'CIF', 'EXW', 'DDP']).default('CIF'),
  defaultPortOfLoading: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  complianceStatus: z.enum(['active', 'blacklisted', 'under_review']).default('active'),
  customsLicenseNo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  let { code, email, ...rest } = parsed.data;

  if (!code) {
    const count = await tdb.$count(suppliers);
    code = `SUP-${String(count + 1).padStart(4, '0')}`;
  }

  const [created] = await tdb.insert(suppliers).values({
    code,
    email: email || undefined,
    ...rest,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}
