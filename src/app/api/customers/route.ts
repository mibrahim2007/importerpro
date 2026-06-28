import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers } from '@/db/schema';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const conditions = q
    ? [or(ilike(customers.name, `%${q}%`), ilike(customers.code, `%${q}%`), ilike(customers.ntn, `%${q}%`))]
    : [];

  const rows = await tdb.select().from(customers)
    .where(conditions.length ? conditions[0] : undefined)
    .orderBy(desc(customers.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const count = await tdb.$count(customers);
  const code = `CUS-${String(count + 1).padStart(6, '0')}`;

  const [created] = await tdb.insert(customers).values({
    code,
    name: body.name,
    customerType: body.customerType ?? 'manufacturer',
    ntn: body.ntn || null,
    strn: body.strn || null,
    cnic: body.cnic || null,
    fbrStatus: body.fbrStatus ?? 'active',
    billingAddress: body.billingAddress || null,
    phone: body.phone || null,
    email: body.email || null,
    paymentTerms: body.paymentTerms ?? 'net_30',
    creditLimitPkr: body.creditLimitPkr || '0',
    salesTaxCategory: body.salesTaxCategory ?? 'registered',
    whtRatePct: body.whtRatePct || '4.5',
    preferredPaymentMode: body.preferredPaymentMode ?? 'cheque',
    bankName: body.bankName || null,
    openingBalance: body.openingBalance || '0',
    notes: body.notes || null,
    isActive: true,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}
