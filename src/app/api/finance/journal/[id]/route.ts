import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { journalEntries, journalLines } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [[entry], lines] = await Promise.all([
    tdb.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1),
    tdb.select().from(journalLines).where(eq(journalLines.jeId, id)).orderBy(asc(journalLines.sortOrder)),
  ]);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ entry, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { action } = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [entry] = await tdb.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const now = new Date();

  if (action === 'post') {
    if (entry.status !== 'draft') return NextResponse.json({ error: 'Can only post a draft entry' }, { status: 422 });
    await tdb.update(journalEntries).set({ status: 'posted', postedAt: now, updatedAt: now }).where(eq(journalEntries.id, id));
  }

  if (action === 'reverse') {
    if (entry.status !== 'posted') return NextResponse.json({ error: 'Can only reverse a posted entry' }, { status: 422 });
    // Create reversal JE
    const lines = await tdb.select().from(journalLines).where(eq(journalLines.jeId, id)).orderBy(asc(journalLines.sortOrder));
    const year = now.getFullYear();
    const count = await tdb.$count(journalEntries);
    const revNo = `JE-${year}-${String(count + 1).padStart(4, '0')}`;
    const [rev] = await tdb.insert(journalEntries).values({
      jeNo: revNo,
      jeDate: now.toISOString().split('T')[0],
      description: `Reversal of ${entry.jeNo}: ${entry.description}`,
      reference: entry.jeNo,
      referenceType: 'reversal',
      referenceId: entry.id,
      totalDebit: entry.totalCredit,
      totalCredit: entry.totalDebit,
      status: 'posted',
      postedAt: now,
      createdById: session.user.id as any,
    }).returning();
    await tdb.insert(journalLines).values(
      lines.map((l, i) => ({
        jeId: rev.id,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: l.credit,
        credit: l.debit,
        currency: l.currency,
        exchangeRate: l.exchangeRate,
        description: l.description,
        sortOrder: i,
      }))
    );
    await tdb.update(journalEntries).set({ status: 'reversed', reversedAt: now, updatedAt: now }).where(eq(journalEntries.id, id));
  }

  const [updated] = await tdb.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
  return NextResponse.json({ entry: updated });
}
