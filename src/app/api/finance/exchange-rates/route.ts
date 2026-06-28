import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { exchangeRates } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rates = await tdb.select().from(exchangeRates).orderBy(desc(exchangeRates.rateDate));
  return NextResponse.json({ rates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { currency, rateDate, rate, source } = await req.json();
  if (!currency || !rate) return NextResponse.json({ error: 'Currency and rate required' }, { status: 400 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [r] = await tdb.insert(exchangeRates).values({
    currency,
    rateDate: rateDate ?? new Date().toISOString().split('T')[0],
    rate: String(rate),
    source: source ?? 'manual',
  }).returning();
  return NextResponse.json({ rate: r }, { status: 201 });
}
