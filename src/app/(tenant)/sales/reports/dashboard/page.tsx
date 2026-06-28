import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/db';
import {
  salesInquiries, salesQuotations, salesOrders, salesInvoices, customerReceipts,
} from '@/db/schema';
import { and, not, inArray, sql } from 'drizzle-orm';
import { DashboardCharts } from '@/components/sales/reports/dashboard-charts';

export const revalidate = 0;

export default async function SalesDashboardPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const mtdStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const ytdStart = `${year}-01-01`;

  const [
    inquiryCount, quotationCount, orderCount, invoicedCount,
    revenueMtd, revenueYtd, collectionsMtd, overdueData,
    monthlyRevenue, topCustomers, quotationFunnel, agingData,
  ] = await Promise.all([
    tdb.select({ count: sql<number>`count(*)::int` }).from(salesInquiries)
      .where(sql`${salesInquiries.status} = 'new'`),

    tdb.select({ count: sql<number>`count(*)::int` }).from(salesQuotations)
      .where(sql`${salesQuotations.status} IN ('draft','sent')`),

    tdb.select({ count: sql<number>`count(*)::int` }).from(salesOrders)
      .where(sql`${salesOrders.status} IN ('confirmed','partially_dispatched')`),

    tdb.select({ count: sql<number>`count(*)::int` }).from(salesInvoices)
      .where(sql`${salesInvoices.status} NOT IN ('draft','cancelled','fully_paid') AND ${salesInvoices.balancePkr} > 0`),

    tdb.select({ total: sql<string>`COALESCE(SUM(subtotal_pkr),0)` }).from(salesInvoices)
      .where(sql`${salesInvoices.status} NOT IN ('draft','cancelled') AND ${salesInvoices.invoiceDate} >= ${mtdStart}::date`),

    tdb.select({ total: sql<string>`COALESCE(SUM(subtotal_pkr),0)` }).from(salesInvoices)
      .where(sql`${salesInvoices.status} NOT IN ('draft','cancelled') AND ${salesInvoices.invoiceDate} >= ${ytdStart}::date`),

    tdb.select({ total: sql<string>`COALESCE(SUM(total_amount_pkr),0)` }).from(customerReceipts)
      .where(sql`${customerReceipts.status} = 'cleared' AND ${customerReceipts.receiptDate} >= ${mtdStart}::date`),

    tdb.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`COALESCE(SUM(balance_pkr),0)`,
    }).from(salesInvoices).where(
      sql`${salesInvoices.status} NOT IN ('draft','cancelled','fully_paid') AND ${salesInvoices.dueDate} < ${today}::date AND ${salesInvoices.balancePkr} > 0`
    ),

    tdb.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', invoice_date::date), 'Mon YY') as month,
             DATE_TRUNC('month', invoice_date::date) as month_date,
             COALESCE(SUM(subtotal_pkr),0)::numeric as revenue
      FROM sales_invoices
      WHERE status NOT IN ('draft','cancelled')
        AND invoice_date::date >= (CURRENT_DATE - INTERVAL '11 months')::date
      GROUP BY 1, 2 ORDER BY 2
    `),

    tdb.execute(sql`
      SELECT c.name as customer_name, COALESCE(SUM(si.subtotal_pkr),0)::numeric as revenue
      FROM sales_invoices si LEFT JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('draft','cancelled') AND si.invoice_date::date >= ${ytdStart}::date
      GROUP BY c.name ORDER BY revenue DESC LIMIT 5
    `),

    tdb.execute(sql`
      SELECT status, COUNT(*)::int as count FROM sales_quotations
      WHERE created_at::date >= ${ytdStart}::date GROUP BY status
    `),

    tdb.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN due_date IS NULL OR due_date::date >= CURRENT_DATE THEN balance_pkr ELSE 0 END),0)::numeric as current,
        COALESCE(SUM(CASE WHEN due_date::date < CURRENT_DATE AND CURRENT_DATE - due_date::date <= 30 THEN balance_pkr ELSE 0 END),0)::numeric as b0_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date::date BETWEEN 31 AND 60 THEN balance_pkr ELSE 0 END),0)::numeric as b31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date::date BETWEEN 61 AND 90 THEN balance_pkr ELSE 0 END),0)::numeric as b61_90,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date::date > 90 THEN balance_pkr ELSE 0 END),0)::numeric as b90plus
      FROM sales_invoices
      WHERE status NOT IN ('draft','cancelled','fully_paid') AND balance_pkr > 0
    `),
  ]);

  const qf: Record<string, number> = {};
  for (const row of quotationFunnel.rows as any[]) qf[row.status] = Number(row.count);
  const wonQ = qf['accepted'] ?? 0;
  const lostQ = qf['rejected'] ?? 0;
  const winRate = (wonQ + lostQ) > 0 ? Math.round((wonQ / (wonQ + lostQ)) * 1000) / 10 : 0;

  const ag = (agingData.rows as any[])[0] ?? {};

  const data = {
    pipeline: {
      inquiries: inquiryCount[0]?.count ?? 0,
      quotations: quotationCount[0]?.count ?? 0,
      orders: orderCount[0]?.count ?? 0,
      invoiced: invoicedCount[0]?.count ?? 0,
    },
    revenue: {
      mtd: parseFloat(revenueMtd[0]?.total ?? '0'),
      ytd: parseFloat(revenueYtd[0]?.total ?? '0'),
    },
    collections: {
      mtd: parseFloat(collectionsMtd[0]?.total ?? '0'),
      overdueAmount: parseFloat(overdueData[0]?.total ?? '0'),
      overdueCount: overdueData[0]?.count ?? 0,
    },
    monthlyRevenue: (monthlyRevenue.rows as any[]).map((r) => ({
      month: r.month as string,
      revenue: parseFloat(r.revenue),
    })),
    topCustomers: (topCustomers.rows as any[]).map((r) => ({
      name: (r.customer_name as string) ?? 'Unknown',
      revenue: parseFloat(r.revenue),
    })),
    quotationFunnel: {
      ...qf, winRate,
      pieData: [
        { name: 'Won', value: wonQ, fill: '#0d9488' },
        { name: 'Lost', value: lostQ, fill: '#ef4444' },
        { name: 'Active', value: (qf['draft'] ?? 0) + (qf['sent'] ?? 0), fill: '#94a3b8' },
      ],
    },
    aging: {
      current: parseFloat(ag.current ?? '0'),
      bucket0_30: parseFloat(ag.b0_30 ?? '0'),
      bucket31_60: parseFloat(ag.b31_60 ?? '0'),
      bucket61_90: parseFloat(ag.b61_90 ?? '0'),
      bucket90plus: parseFloat(ag.b90plus ?? '0'),
    },
  };

  return <DashboardCharts data={data} />;
}
