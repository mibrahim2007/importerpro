import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { salesInvoices, customers } from '@/db/schema';
import { eq, sql, and, not, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const today = new Date().toISOString().split('T')[0];

  const rows = await tdb.select({
    invoiceId: salesInvoices.id,
    invoiceNo: salesInvoices.invoiceNo,
    invoiceDate: salesInvoices.invoiceDate,
    dueDate: salesInvoices.dueDate,
    status: salesInvoices.status,
    grandTotalPkr: salesInvoices.grandTotalPkr,
    balancePkr: salesInvoices.balancePkr,
    customerId: salesInvoices.customerId,
    customerName: customers.name,
    customerCode: customers.code,
    creditLimitPkr: customers.creditLimitPkr,
  })
  .from(salesInvoices)
  .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
  .where(
    and(
      not(inArray(salesInvoices.status, ['draft', 'cancelled', 'fully_paid'] as any[])),
      sql`${salesInvoices.balancePkr} > 0`,
    )
  )
  .orderBy(salesInvoices.dueDate);

  // Compute aging buckets per invoice
  const invoices = rows.map((r) => {
    const balance = parseFloat(String(r.balancePkr ?? '0'));
    const due = r.dueDate;
    let daysOverdue = 0;
    if (due) {
      const diff = new Date(today).getTime() - new Date(due).getTime();
      daysOverdue = Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    return {
      ...r,
      balance,
      daysOverdue,
      current: daysOverdue <= 0 ? balance : 0,
      bucket0_30: daysOverdue > 0 && daysOverdue <= 30 ? balance : 0,
      bucket31_60: daysOverdue > 30 && daysOverdue <= 60 ? balance : 0,
      bucket61_90: daysOverdue > 60 && daysOverdue <= 90 ? balance : 0,
      bucket90plus: daysOverdue > 90 ? balance : 0,
    };
  });

  // Group by customer
  const customerMap: Record<string, any> = {};
  for (const inv of invoices) {
    if (!customerMap[inv.customerId]) {
      customerMap[inv.customerId] = {
        customerId: inv.customerId, customerName: inv.customerName,
        customerCode: inv.customerCode, creditLimitPkr: inv.creditLimitPkr,
        total: 0, current: 0, bucket0_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90plus: 0,
        invoices: [],
      };
    }
    const c = customerMap[inv.customerId];
    c.total += inv.balance;
    c.current += inv.current;
    c.bucket0_30 += inv.bucket0_30;
    c.bucket31_60 += inv.bucket31_60;
    c.bucket61_90 += inv.bucket61_90;
    c.bucket90plus += inv.bucket90plus;
    c.invoices.push(inv);
  }

  const grouped = Object.values(customerMap).sort((a: any, b: any) => b.total - a.total);

  const totals = grouped.reduce(
    (s: any, c: any) => ({
      total: s.total + c.total, current: s.current + c.current,
      bucket0_30: s.bucket0_30 + c.bucket0_30, bucket31_60: s.bucket31_60 + c.bucket31_60,
      bucket61_90: s.bucket61_90 + c.bucket61_90, bucket90plus: s.bucket90plus + c.bucket90plus,
    }),
    { total: 0, current: 0, bucket0_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90plus: 0 }
  );

  return NextResponse.json({ customers: grouped, totals, asOf: today });
}
