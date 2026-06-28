import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(shipments).orderBy(desc(shipments.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();

  const count = await tdb.$count(shipments);
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, '0');
  const shipmentNo = `SHP-${year}-${seq}`;

  const [created] = await tdb.insert(shipments).values({
    shipmentNo,
    poId: body.poId || null,
    lcId: body.lcId || null,
    mode: body.mode ?? 'sea',
    vesselName: body.vesselName || null,
    voyageNo: body.voyageNo || null,
    shippingLineId: body.shippingLineId || null,
    shippingLineName: body.shippingLineName || null,
    freightForwarderId: body.freightForwarderId || null,
    freightForwarderName: body.freightForwarderName || null,
    blNo: body.blNo || null,
    blDate: body.blDate || null,
    blType: body.blType ?? 'original',
    portOfLoading: body.portOfLoading || null,
    portOfDischarge: body.portOfDischarge || null,
    etd: body.etd || null,
    atd: body.atd || null,
    eta: body.eta || null,
    ata: body.ata || null,
    freightAmount: body.freightAmount ? String(body.freightAmount) : null,
    freightCurrency: body.freightCurrency ?? 'USD',
    freightPayment: body.freightPayment ?? 'prepaid',
    freightInvoiceNo: body.freightInvoiceNo || null,
    freightInvoiceDate: body.freightInvoiceDate || null,
    packageCount: body.packageCount || null,
    grossWeightKg: body.grossWeightKg ? String(body.grossWeightKg) : null,
    netWeightKg: body.netWeightKg ? String(body.netWeightKg) : null,
    volumeCbm: body.volumeCbm ? String(body.volumeCbm) : null,
    notes: body.notes || null,
    createdById: session.user.id,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}
