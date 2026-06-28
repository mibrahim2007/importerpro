import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers, customerAddresses, customerContacts, customerPricelists, products } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[customer], addresses, contacts, pricelists] = await Promise.all([
    tdb.select().from(customers).where(eq(customers.id, id)).limit(1),
    tdb.select().from(customerAddresses).where(eq(customerAddresses.customerId, id)),
    tdb.select().from(customerContacts).where(eq(customerContacts.customerId, id)),
    tdb.select({
      id: customerPricelists.id,
      productId: customerPricelists.productId,
      productName: products.name,
      productCode: products.code,
      priceTier: customerPricelists.priceTier,
      pricingBasis: customerPricelists.pricingBasis,
      unitPricePkr: customerPricelists.unitPricePkr,
      markupPct: customerPricelists.markupPct,
      effectiveFrom: customerPricelists.effectiveFrom,
      effectiveTo: customerPricelists.effectiveTo,
      isActive: customerPricelists.isActive,
    }).from(customerPricelists)
      .leftJoin(products, eq(products.id, customerPricelists.productId))
      .where(eq(customerPricelists.customerId, id)),
  ]);

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ customer, addresses, contacts, pricelists });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  if (body.action === 'toggle_active') {
    const [[cur]] = await Promise.all([tdb.select({ isActive: customers.isActive }).from(customers).where(eq(customers.id, id)).limit(1)]);
    await tdb.update(customers).set({ isActive: !cur?.isActive }).where(eq(customers.id, id));
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'add_contact') {
    const [c] = await tdb.insert(customerContacts).values({
      customerId: id,
      name: body.name,
      designation: body.designation || null,
      email: body.email || null,
      phone: body.phone || null,
      whatsapp: body.whatsapp || null,
      isPrimary: body.isPrimary ?? false,
    }).returning();
    return NextResponse.json(c, { status: 201 });
  }

  if (body.action === 'delete_contact') {
    await tdb.delete(customerContacts).where(and(eq(customerContacts.id, body.contactId), eq(customerContacts.customerId, id)));
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'add_address') {
    const [a] = await tdb.insert(customerAddresses).values({
      customerId: id,
      label: body.label || null,
      address: body.address,
      city: body.city || null,
      isDefault: body.isDefault ?? false,
    }).returning();
    return NextResponse.json(a, { status: 201 });
  }

  if (body.action === 'delete_address') {
    await tdb.delete(customerAddresses).where(and(eq(customerAddresses.id, body.addressId), eq(customerAddresses.customerId, id)));
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'add_price') {
    const [p] = await tdb.insert(customerPricelists).values({
      customerId: id,
      productId: body.productId,
      priceTier: body.priceTier ?? 'standard',
      pricingBasis: body.pricingBasis ?? 'fixed',
      unitPricePkr: body.unitPricePkr || null,
      markupPct: body.markupPct || null,
      effectiveFrom: body.effectiveFrom || null,
      effectiveTo: body.effectiveTo || null,
      isActive: true,
    }).returning();
    return NextResponse.json(p, { status: 201 });
  }

  if (body.action === 'delete_price') {
    await tdb.delete(customerPricelists).where(and(eq(customerPricelists.id, body.priceId), eq(customerPricelists.customerId, id)));
    return NextResponse.json({ ok: true });
  }

  // Default: update customer fields
  const allowed = ['name', 'customerType', 'ntn', 'strn', 'cnic', 'fbrStatus', 'billingAddress', 'phone', 'email',
    'paymentTerms', 'creditLimitPkr', 'salesTaxCategory', 'whtRatePct', 'preferredPaymentMode', 'bankName', 'openingBalance', 'notes', 'isActive'];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];

  if (Object.keys(update).length) {
    await tdb.update(customers).set(update).where(eq(customers.id, id));
  }
  return NextResponse.json({ ok: true });
}
