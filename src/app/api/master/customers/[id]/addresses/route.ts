import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { customerAddresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  label: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: customerId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tdb = await getTenantDb(session.user.tenantSlug);

  // If setting as default, clear existing defaults
  if (parsed.data.isDefault) {
    await tdb.update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customerId));
  }

  const [created] = await tdb.insert(customerAddresses).values({ customerId, ...parsed.data }).returning();
  return NextResponse.json(created, { status: 201 });
}
