import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { vendorBills, vendorBillLines, purchaseReturnAuthorizations, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [dn] = await tdb
    .select({
      id: vendorBills.id,
      billNo: vendorBills.billNo,
      billDate: vendorBills.billDate,
      dueDate: vendorBills.dueDate,
      supplierId: vendorBills.supplierId,
      praId: vendorBills.praId,
      linkedBillId: vendorBills.linkedBillId,
      debitApplicationType: vendorBills.debitApplicationType,
      status: vendorBills.status,
      currency: vendorBills.currency,
      exchangeRate: vendorBills.exchangeRate,
      subtotal: vendorBills.subtotal,
      taxAmount: vendorBills.taxAmount,
      totalAmount: vendorBills.totalAmount,
      totalAmountPkr: vendorBills.totalAmountPkr,
      totalPaid: vendorBills.totalPaid,
      balanceDue: vendorBills.balanceDue,
      notes: vendorBills.notes,
      supplierInvoiceNo: vendorBills.supplierInvoiceNo,
      postedAt: vendorBills.postedAt,
      createdAt: vendorBills.createdAt,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
    })
    .from(vendorBills)
    .leftJoin(suppliers, eq(suppliers.id, vendorBills.supplierId))
    .where(eq(vendorBills.id, id));

  if (!dn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await tdb
    .select()
    .from(vendorBillLines)
    .where(eq(vendorBillLines.billId, id))
    .orderBy(vendorBillLines.sortOrder);

  // Linked original bill if any
  let linkedBill = null;
  if (dn.linkedBillId) {
    const [lb] = await tdb.select({ billNo: vendorBills.billNo, totalAmountPkr: vendorBills.totalAmountPkr, balanceDue: vendorBills.balanceDue })
      .from(vendorBills).where(eq(vendorBills.id, dn.linkedBillId));
    linkedBill = lb ?? null;
  }

  // Linked PRA
  let linkedPra = null;
  if (dn.praId) {
    const [pra] = await tdb.select({ praNo: purchaseReturnAuthorizations.praNo })
      .from(purchaseReturnAuthorizations).where(eq(purchaseReturnAuthorizations.id, dn.praId));
    linkedPra = pra ?? null;
  }

  return NextResponse.json({ ...dn, lines, linkedBill, linkedPra });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const body = await req.json();
  const { action } = body;

  const [dn] = await tdb.select({
    status: vendorBills.status,
    totalAmountPkr: vendorBills.totalAmountPkr,
    linkedBillId: vendorBills.linkedBillId,
    debitApplicationType: vendorBills.debitApplicationType,
    praId: vendorBills.praId,
  }).from(vendorBills).where(eq(vendorBills.id, id));

  if (!dn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'post') {
    if (dn.status !== 'draft') return NextResponse.json({ error: 'Only draft debit notes can be posted' }, { status: 400 });

    const [updated] = await tdb.update(vendorBills)
      .set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() })
      .where(eq(vendorBills.id, id)).returning();

    // Apply against linked vendor bill if applicable
    if (dn.debitApplicationType === 'applied_to_bill' && dn.linkedBillId) {
      const [origBill] = await tdb.select({
        totalPaid: vendorBills.totalPaid,
        totalAmountPkr: vendorBills.totalAmountPkr,
        status: vendorBills.status,
      }).from(vendorBills).where(eq(vendorBills.id, dn.linkedBillId));

      if (origBill) {
        const debitAmtPkr = parseFloat(String(dn.totalAmountPkr ?? 0));
        const newTotalPaid = parseFloat(String(origBill.totalPaid ?? '0')) + debitAmtPkr;
        const newBalance = parseFloat(String(origBill.totalAmountPkr ?? '0')) - newTotalPaid;
        const newStatus = newBalance <= 0 ? 'paid' : newTotalPaid > 0 ? 'partially_paid' : origBill.status;

        await tdb.update(vendorBills)
          .set({
            totalPaid: String(Math.min(newTotalPaid, parseFloat(String(origBill.totalAmountPkr ?? '0')))),
            balanceDue: String(Math.max(0, newBalance)),
            status: newStatus as any,
            updatedAt: new Date(),
          })
          .where(eq(vendorBills.id, dn.linkedBillId));
      }
    }

    // Update linked PRA status
    if (dn.praId) {
      await tdb.update(purchaseReturnAuthorizations)
        .set({ debitNoteId: id, status: 'debit_issued', updatedAt: new Date() })
        .where(eq(purchaseReturnAuthorizations.id, dn.praId));
    }

    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    if (!['draft', 'posted'].includes(dn.status ?? '')) {
      return NextResponse.json({ error: 'Cannot cancel this debit note' }, { status: 400 });
    }
    const [updated] = await tdb.update(vendorBills)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(vendorBills.id, id)).returning();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
