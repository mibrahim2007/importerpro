import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments } from '@/db/schema';
import { eq } from 'drizzle-orm';

const ALLOWED_FROM: Record<string, string[]> = {
  book:             ['draft'],
  mark_sailing:     ['booked'],
  mark_arrived:     ['sailing'],
  release_do:       ['arrived'],
  customs_cleared:  ['do_released'],
  grn_done:         ['customs_cleared'],
  cancel:           ['draft', 'booked'],
};

const ACTION_STATUS: Record<string, string> = {
  book:             'booked',
  mark_sailing:     'sailing',
  mark_arrived:     'arrived',
  release_do:       'do_released',
  customs_cleared:  'customs_cleared',
  grn_done:         'grn_done',
  cancel:           'cancelled',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [row] = await tdb.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();

  const [current] = await tdb.select({ status: shipments.status }).from(shipments).where(eq(shipments.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action, ...fields } = body;

  if (action) {
    const allowed = ALLOWED_FROM[action];
    if (!allowed) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    if (!allowed.includes(current.status ?? '')) {
      return NextResponse.json({ error: `Cannot ${action} from status ${current.status}` }, { status: 422 });
    }
    const newStatus = ACTION_STATUS[action] as any;
    const extra: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
    // Capture dates at transition time if not provided
    if (action === 'mark_arrived' && !fields.ata) extra.ata = new Date().toISOString().split('T')[0];
    if (action === 'release_do' && fields.doNo) extra.doNo = fields.doNo;
    if (action === 'release_do' && !fields.doReleasedDate) extra.doReleasedDate = new Date().toISOString().split('T')[0];
    const [updated] = await tdb.update(shipments).set(extra).where(eq(shipments.id, id)).returning();
    return NextResponse.json(updated);
  }

  // Field update (draft only)
  if (current.status !== 'draft' && current.status !== 'booked') {
    return NextResponse.json({ error: 'Can only edit draft/booked shipments' }, { status: 422 });
  }

  const EDITABLE: Record<string, keyof typeof shipments.$inferInsert> = {
    vesselName: 'vesselName', voyageNo: 'voyageNo', blNo: 'blNo', blDate: 'blDate', blType: 'blType',
    etd: 'etd', atd: 'atd', eta: 'eta', ata: 'ata',
    portOfLoading: 'portOfLoading', portOfDischarge: 'portOfDischarge',
    freightAmount: 'freightAmount', freightCurrency: 'freightCurrency', freightPayment: 'freightPayment',
    freightInvoiceNo: 'freightInvoiceNo', freightInvoiceDate: 'freightInvoiceDate', freightPaidDate: 'freightPaidDate',
    packageCount: 'packageCount', grossWeightKg: 'grossWeightKg', netWeightKg: 'netWeightKg', volumeCbm: 'volumeCbm',
    shippingLineName: 'shippingLineName', freightForwarderName: 'freightForwarderName',
    blReceivedAtBank: 'blReceivedAtBank', blReceivedDate: 'blReceivedDate',
    docsReleasedByBank: 'docsReleasedByBank', docsReleasedDate: 'docsReleasedDate',
    docsSentToAgent: 'docsSentToAgent', docsSentDate: 'docsSentDate',
    courierTrackingNo: 'courierTrackingNo', doNo: 'doNo', doReleasedDate: 'doReleasedDate',
    notes: 'notes',
  };

  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(fields)) {
    if (k in EDITABLE) update[EDITABLE[k]] = v ?? null;
  }

  const [updated] = await tdb.update(shipments).set(update as any).where(eq(shipments.id, id)).returning();
  return NextResponse.json(updated);
}
