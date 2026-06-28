import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import {
  salesInquiries, salesQuotations, salesOrders, salesInvoices,
  customerReceipts, customers,
} from '@/db/schema';
import { eq, sql, and, not, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const mtdStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const ytdStart = `${year}-01-01`;
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMtdStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const prevMtdEnd = `${year}-${String(month).padStart(2, '0')}-01`;

  const [
    inquiryCount,
    quotationCount,
    orderCount,
    invoicedCount,
    revenueMtd,
    revenueYtd,
    revenuePrevMtd,
    collectionsMtd,
    overdueData,
    monthlyRevenue,
    topCustomers,
    quotationFunnel,
    agingData,
  ] = await Promise.all([
    // Open inquiries
    tdb.select({ count: sql<number>`count(*)` }).from(salesInquiries)
      .where(inArray(salesInquiries.status, ['new'] as any[])),

    // Active quotations
    tdb.select({ count: sql<number>`count(*)` }).from(salesQuotations)
      .where(inArray(salesQuotations.status, ['draft', 'sent'] as any[])),

    // Confirmed orders
    tdb.select({ count: sql<number>`count(*)` }).from(salesOrders)
      .where(inArray(salesOrders.status, ['confirmed', 'partially_dispatched'] as any[])),

    // Unpaid invoices count
    tdb.select({ count: sql<number>`count(*)` }).from(salesInvoices)
      .where(and(
        not(inArray(salesInvoices.status, ['draft', 'cancelled', 'fully_paid'] as any[])),
        sql`${salesInvoices.balancePkr} > 0`,
      )),

    // Revenue MTD
    tdb.select({ total: sql<string>`COALESCE(SUM(subtotal_pkr), 0)` }).from(salesInvoices)
      .where(and(
        not(inArray(salesInvoices.status, ['draft', 'cancelled'] as any[])),
        sql`${salesInvoices.invoiceDate} >= ${mtdStart}`,
      )),

    // Revenue YTD
    tdb.select({ total: sql<string>`COALESCE(SUM(subtotal_pkr), 0)` }).from(salesInvoices)
      .where(and(
        not(inArray(salesInvoices.status, ['draft', 'cancelled'] as any[])),
        sql`${salesInvoices.invoiceDate} >= ${ytdStart}`,
      )),

    // Revenue previous month (same period comparison)
    tdb.select({ total: sql<string>`COALESCE(SUM(subtotal_pkr), 0)` }).from(salesInvoices)
      .where(and(
        not(inArray(salesInvoices.status, ['draft', 'cancelled'] as any[])),
        sql`${salesInvoices.invoiceDate} >= ${prevMtdStart}`,
        sql`${salesInvoices.invoiceDate} < ${prevMtdEnd}`,
      )),

    // Collections MTD (cleared receipts)
    tdb.select({ total: sql<string>`COALESCE(SUM(total_amount_pkr), 0)` }).from(customerReceipts)
      .where(and(
        eq(customerReceipts.status, 'cleared'),
        sql`${customerReceipts.receiptDate} >= ${mtdStart}`,
      )),

    // Overdue
    tdb.select({
      count: sql<number>`count(*)`,
      total: sql<string>`COALESCE(SUM(balance_pkr), 0)`,
    }).from(salesInvoices).where(and(
      not(inArray(salesInvoices.status, ['draft', 'cancelled', 'fully_paid'] as any[])),
      sql`${salesInvoices.dueDate} < ${today}`,
      sql`${salesInvoices.balancePkr} > 0`,
    )),

    // Monthly revenue last 12 months
    tdb.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', invoice_date::date), 'Mon YY') as month,
        DATE_TRUNC('month', invoice_date::date) as month_date,
        COALESCE(SUM(subtotal_pkr), 0)::numeric as revenue,
        COALESCE(SUM(sales_tax_pkr), 0)::numeric as tax
      FROM sales_invoices
      WHERE status NOT IN ('draft', 'cancelled')
        AND invoice_date::date >= (CURRENT_DATE - INTERVAL '11 months')::date
      GROUP BY 1, 2
      ORDER BY 2
    `),

    // Top 5 customers by revenue
    tdb.execute(sql`
      SELECT
        si.customer_id,
        c.name as customer_name,
        COALESCE(SUM(si.subtotal_pkr), 0)::numeric as revenue,
        COUNT(si.id) as invoice_count
      FROM sales_invoices si
      LEFT JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('draft', 'cancelled')
        AND si.invoice_date::date >= ${ytdStart}::date
      GROUP BY si.customer_id, c.name
      ORDER BY revenue DESC
      LIMIT 5
    `),

    // Quotation funnel
    tdb.execute(sql`
      SELECT status, COUNT(*) as count
      FROM sales_quotations
      WHERE created_at::date >= ${ytdStart}::date
      GROUP BY status
    `),

    // Aging buckets total
    tdb.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN due_date::date >= CURRENT_DATE THEN balance_pkr ELSE 0 END), 0)::numeric as current,
        COALESCE(SUM(CASE WHEN due_date::date < CURRENT_DATE AND CURRENT_DATE - due_date::date <= 30 THEN balance_pkr ELSE 0 END), 0)::numeric as bucket0_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date::date BETWEEN 31 AND 60 THEN balance_pkr ELSE 0 END), 0)::numeric as bucket31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date::date BETWEEN 61 AND 90 THEN balance_pkr ELSE 0 END), 0)::numeric as bucket61_90,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date::date > 90 THEN balance_pkr ELSE 0 END), 0)::numeric as bucket90plus
      FROM sales_invoices
      WHERE status NOT IN ('draft', 'cancelled', 'fully_paid')
        AND balance_pkr > 0
    `),
  ]);

  // Process quotation funnel
  const qf: Record<string, number> = {};
  for (const row of quotationFunnel.rows as any[]) qf[row.status] = Number(row.count);
  const totalQ = Object.values(qf).reduce((s, v) => s + v, 0);
  const wonQ = qf['accepted'] ?? 0;
  const lostQ = qf['rejected'] ?? 0;
  const winRate = totalQ > 0 ? ((wonQ / (wonQ + lostQ)) * 100) : 0;

  const revMtd = parseFloat(revenueMtd[0]?.total ?? '0');
  const revPrev = parseFloat(revenuePrevMtd[0]?.total ?? '0');
  const revGrowth = revPrev > 0 ? ((revMtd - revPrev) / revPrev) * 100 : null;

  const aging = (agingData.rows as any[])[0] ?? {};

  return NextResponse.json({
    pipeline: {
      inquiries: Number(inquiryCount[0]?.count ?? 0),
      quotations: Number(quotationCount[0]?.count ?? 0),
      orders: Number(orderCount[0]?.count ?? 0),
      invoiced: Number(invoicedCount[0]?.count ?? 0),
    },
    revenue: {
      mtd: revMtd,
      ytd: parseFloat(revenueYtd[0]?.total ?? '0'),
      prevMtd: revPrev,
      growth: revGrowth,
    },
    collections: {
      mtd: parseFloat(collectionsMtd[0]?.total ?? '0'),
      overdueAmount: parseFloat(overdueData[0]?.total ?? '0'),
      overdueCount: Number(overdueData[0]?.count ?? 0),
    },
    monthlyRevenue: (monthlyRevenue.rows as any[]).map((r) => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
      tax: parseFloat(r.tax),
    })),
    topCustomers: (topCustomers.rows as any[]).map((r) => ({
      name: r.customer_name ?? 'Unknown',
      revenue: parseFloat(r.revenue),
      invoices: Number(r.invoice_count),
    })),
    quotationFunnel: {
      total: totalQ, draft: qf['draft'] ?? 0, sent: qf['sent'] ?? 0,
      accepted: wonQ, rejected: lostQ, winRate: Math.round(winRate * 10) / 10,
    },
    aging: {
      current: parseFloat(aging.current ?? '0'),
      bucket0_30: parseFloat(aging.bucket0_30 ?? '0'),
      bucket31_60: parseFloat(aging.bucket31_60 ?? '0'),
      bucket61_90: parseFloat(aging.bucket61_90 ?? '0'),
      bucket90plus: parseFloat(aging.bucket90plus ?? '0'),
    },
  });
}
