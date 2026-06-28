import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Update document arrival fields on the shipment itself
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();
  const today = new Date().toISOString().split('T')[0];

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if ('blReceivedAtBank' in body) {
    update.blReceivedAtBank = body.blReceivedAtBank;
    if (body.blReceivedAtBank && !body.blReceivedDate) update.blReceivedDate = today;
    if (body.blReceivedDate) update.blReceivedDate = body.blReceivedDate;
  }
  if ('docsReleasedByBank' in body) {
    update.docsReleasedByBank = body.docsReleasedByBank;
    if (body.docsReleasedByBank && !body.docsReleasedDate) update.docsReleasedDate = today;
    if (body.docsReleasedDate) update.docsReleasedDate = body.docsReleasedDate;
  }
  if ('docsSentToAgent' in body) {
    update.docsSentToAgent = body.docsSentToAgent;
    if (body.docsSentToAgent && !body.docsSentDate) update.docsSentDate = today;
    if (body.docsSentDate) update.docsSentDate = body.docsSentDate;
  }
  if ('courierTrackingNo' in body) update.courierTrackingNo = body.courierTrackingNo || null;

  const [updated] = await tdb.update(shipments).set(update as any).where(eq(shipments.id, id)).returning();
  return NextResponse.json(updated);
}
