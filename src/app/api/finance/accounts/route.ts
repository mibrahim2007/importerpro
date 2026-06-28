import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { chartOfAccounts } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const accounts = await tdb.select().from(chartOfAccounts).orderBy(asc(chartOfAccounts.sortOrder), asc(chartOfAccounts.code));
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { code, name, accountType, parentCode, isGroup, currency, openingBalance, notes, sortOrder } = body;
  if (!code || !name || !accountType) return NextResponse.json({ error: 'Code, name and type are required' }, { status: 400 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [acc] = await tdb.insert(chartOfAccounts).values({
    code: code.trim(),
    name: name.trim(),
    accountType,
    parentCode: parentCode || null,
    isGroup: !!isGroup,
    currency: currency || 'PKR',
    openingBalance: openingBalance ? String(openingBalance) : '0',
    notes: notes || null,
    sortOrder: sortOrder ?? 0,
    isSystem: false,
    isActive: true,
  }).returning();
  return NextResponse.json({ account: acc }, { status: 201 });
}
