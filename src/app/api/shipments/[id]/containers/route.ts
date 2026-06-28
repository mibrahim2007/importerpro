import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipmentContainers, shipments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(shipmentContainers).where(eq(shipmentContainers.shipmentId, id));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();

  const [shp] = await tdb.select({ id: shipments.id }).from(shipments).where(eq(shipments.id, id)).limit(1);
  if (!shp) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });

  const [created] = await tdb.insert(shipmentContainers).values({
    shipmentId: id,
    containerNo: body.containerNo,
    sealNo: body.sealNo || null,
    containerType: body.containerType ?? '20GP',
    portFreeDays: body.portFreeDays ?? 7,
    detentionFreeDays: body.detentionFreeDays ?? 7,
    demurrageRatePerDay: body.demurrageRatePerDay ? String(body.demurrageRatePerDay) : null,
    demurrageCurrency: body.demurrageCurrency ?? 'USD',
    portArrivalDate: body.portArrivalDate || null,
    portClearanceDate: body.portClearanceDate || null,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();
  const { containerId, ...fields } = body;

  if (!containerId) return NextResponse.json({ error: 'containerId required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  const ALLOWED = ['portArrivalDate', 'portClearanceDate', 'emptyReturnDate', 'demurrageRatePerDay',
    'demurrageCurrency', 'portFreeDays', 'detentionFreeDays', 'demurrageInvoiceNo', 'demurragePaidAmount', 'sealNo'];
  for (const k of ALLOWED) {
    if (k in fields) update[k] = fields[k] ?? null;
  }

  const [updated] = await tdb.update(shipmentContainers).set(update as any)
    .where(eq(shipmentContainers.id, containerId)).returning();
  return NextResponse.json(updated);
}
