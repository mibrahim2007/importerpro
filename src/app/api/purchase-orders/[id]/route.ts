import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { purchaseOrders, poLines, poAmendments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const statusSchema = z.object({
  action: z.enum(['confirm', 'cancel', 'request_lc', 'lc_opened', 'goods_dispatched', 'mark_received']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [po] = await tdb.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Status action
  if (body.action) {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const role = session.user.role ?? '';
    const canApprove = ['tenant_admin', 'procurement_manager', 'finance_manager'].includes(role);

    const STATUS_MAP: Record<string, string> = {
      confirm: 'confirmed',
      cancel: 'cancelled',
      request_lc: 'lc_requested',
      lc_opened: 'lc_opened',
      goods_dispatched: 'goods_dispatched',
      mark_received: 'fully_received',
    };

    const ALLOWED_FROM: Record<string, string[]> = {
      confirm: ['draft'],
      cancel: ['draft', 'confirmed'],
      request_lc: ['confirmed'],
      lc_opened: ['lc_requested'],
      goods_dispatched: ['lc_opened'],
      mark_received: ['goods_dispatched', 'partially_received'],
    };

    if (!canApprove && parsed.data.action !== 'cancel')
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    if (!ALLOWED_FROM[parsed.data.action]?.includes(po.status ?? ''))
      return NextResponse.json({ error: `Cannot ${parsed.data.action} a ${po.status} PO` }, { status: 409 });

    const [updated] = await tdb.update(purchaseOrders)
      .set({ status: STATUS_MAP[parsed.data.action] as any, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  // Field update (amendment) — only on draft POs
  if (po.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft POs can be edited. Use amend for confirmed POs.' }, { status: 409 });
  }

  const { exchangeRate, freightAmount, insuranceAmount, lines, ...rest } = body;
  let updates: Record<string, any> = { ...rest, updatedAt: new Date() };
  if (exchangeRate) updates.exchangeRate = String(exchangeRate);
  if (freightAmount !== undefined) updates.freightAmount = String(freightAmount);
  if (insuranceAmount !== undefined) updates.insuranceAmount = String(insuranceAmount);

  if (lines) {
    // Replace lines
    await tdb.delete(poLines).where(eq(poLines.poId, id));
    await tdb.insert(poLines).values(
      lines.map((l: any, i: number) => ({
        poId: id,
        productId: l.productId,
        hsCode: l.hsCode,
        qty: String(l.qty),
        uom: l.uom ?? undefined,
        unitPrice: String(l.unitPrice),
        totalPrice: String((Number(l.qty) * Number(l.unitPrice)).toFixed(4)),
        sortOrder: i,
      }))
    );
    const subtotal = lines.reduce((s: number, l: any) => s + Number(l.qty) * Number(l.unitPrice), 0);
    const freight = Number(freightAmount ?? po.freightAmount ?? 0);
    const insurance = Number(insuranceAmount ?? po.insuranceAmount ?? 0);
    const cifUsd = subtotal + freight + insurance;
    const rate = Number(exchangeRate ?? po.exchangeRate ?? 0);
    updates.subtotalAmount = String(subtotal.toFixed(4));
    updates.cifValueUsd = String(cifUsd.toFixed(4));
    if (rate > 0) updates.cifValuePkr = String((cifUsd * rate).toFixed(2));
  }

  const [updated] = await tdb.update(purchaseOrders).set(updates).where(eq(purchaseOrders.id, id)).returning();
  return NextResponse.json(updated);
}
