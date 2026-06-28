import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { journalEntries, journalLines } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const entries = await tdb.select().from(journalEntries).orderBy(desc(journalEntries.jeDate));
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { jeDate, description, reference, referenceType, lines } = body;

  if (!description || !lines?.length) return NextResponse.json({ error: 'Description and lines required' }, { status: 400 });

  const totalDebit = lines.reduce((s: number, l: any) => s + parseFloat(l.debit ?? '0'), 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + parseFloat(l.credit ?? '0'), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01)
    return NextResponse.json({ error: `Journal entry does not balance: Dr ${totalDebit.toFixed(2)} ≠ Cr ${totalCredit.toFixed(2)}` }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);
  const year = new Date().getFullYear();
  const count = await tdb.$count(journalEntries);
  const jeNo = `JE-${year}-${String(count + 1).padStart(4, '0')}`;

  const [entry] = await tdb.insert(journalEntries).values({
    jeNo,
    jeDate: jeDate ?? new Date().toISOString().split('T')[0],
    description,
    reference: reference || null,
    referenceType: referenceType || 'manual',
    totalDebit: String(totalDebit),
    totalCredit: String(totalCredit),
    status: 'draft',
    createdById: session.user.id as any,
  }).returning();

  await tdb.insert(journalLines).values(
    lines.map((l: any, i: number) => ({
      jeId: entry.id,
      accountCode: l.accountCode,
      accountName: l.accountName || null,
      debit: String(parseFloat(l.debit ?? '0')),
      credit: String(parseFloat(l.credit ?? '0')),
      currency: l.currency || 'PKR',
      exchangeRate: String(parseFloat(l.exchangeRate ?? '1')),
      description: l.description || null,
      sortOrder: i,
    }))
  );

  return NextResponse.json({ entry }, { status: 201 });
}
