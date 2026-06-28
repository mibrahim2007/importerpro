import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().optional(),
  supplierType: z.enum(['manufacturer', 'trader', 'clearing_agent', 'freight_forwarder', 'shipping_line', 'port_agent']).optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankSwift: z.string().optional(),
  bankCurrency: z.enum(['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']).optional(),
  paymentTerms: z.enum(['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']).optional(),
  preferredIncoterms: z.enum(['FOB', 'CFR', 'CIF', 'EXW', 'DDP']).optional(),
  defaultPortOfLoading: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  complianceStatus: z.enum(['active', 'blacklisted', 'under_review']).optional(),
  customsLicenseNo: z.string().optional(),
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
  const [updated] = await tdb.update(suppliers).set({ email: email || undefined, ...rest }).where(eq(suppliers.id, id)).returning();
  return NextResponse.json(updated);
}
