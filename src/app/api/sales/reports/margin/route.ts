import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const p = req.nextUrl.searchParams;
  const from = p.get('from');
  const to = p.get('to');
  const ytdStart = `${new Date().getFullYear()}-01-01`;

  // Join invoice lines → quotation lines via SO chain to get landed cost reference
  // Since direct linkage isn't always present, use the average landed cost from
  // stock_ledger purchase_in entries for each product as cost basis
  const rows = await tdb.execute(sql`
    SELECT
      p.id                                                    AS product_id,
      p.name                                                  AS product_name,
      p.code                                                  AS product_code,
      p.hs_code,
      SUM(sil.qty)::numeric                                   AS total_qty_sold,
      MAX(sil.uom)                                            AS uom,
      SUM(sil.taxable_value_pkr)::numeric                    AS total_revenue,
      AVG(sil.unit_price_pkr::numeric)                       AS avg_selling_price,
      -- Landed cost: average from quotation lines that reference this product (via invoice → SO → quotation)
      (
        SELECT AVG(sql2.landed_cost_ref_pkr::numeric)
        FROM sales_invoice_lines sil2
        JOIN sales_invoices si2 ON si2.id = sil2.invoice_id
        JOIN sales_orders so2 ON so2.id = si2.so_id
        JOIN sales_quotations sq2 ON sq2.id = so2.quotation_id
        JOIN sales_quotation_lines sql2 ON sql2.quotation_id = sq2.id AND sql2.product_id = sil2.product_id
        WHERE sil2.product_id = p.id
          AND sql2.landed_cost_ref_pkr IS NOT NULL
          AND si2.status NOT IN ('draft','cancelled')
          ${from ? sql`AND si2.invoice_date::date >= ${from}::date` : sql``}
          ${to ? sql`AND si2.invoice_date::date <= ${to}::date` : sql``}
      )                                                       AS avg_landed_cost,
      COUNT(DISTINCT si.invoice_no)::integer                  AS invoice_count
    FROM sales_invoice_lines sil
    JOIN sales_invoices si ON si.id = sil.invoice_id
    LEFT JOIN products p ON p.id = sil.product_id
    WHERE si.status NOT IN ('draft','cancelled')
      AND sil.product_id IS NOT NULL
      ${from ? sql`AND si.invoice_date::date >= ${from}::date` : sql`AND si.invoice_date::date >= ${ytdStart}::date`}
      ${to ? sql`AND si.invoice_date::date <= ${to}::date` : sql``}
    GROUP BY p.id, p.name, p.code, p.hs_code
    ORDER BY total_revenue DESC
  `);

  const products = (rows as any[]).map((r) => {
    const revenue = parseFloat(r.total_revenue ?? '0');
    const qty = parseFloat(r.total_qty_sold ?? '0');
    const avgSell = parseFloat(r.avg_selling_price ?? '0');
    const avgCost = r.avg_landed_cost ? parseFloat(r.avg_landed_cost) : null;
    const totalCost = avgCost ? avgCost * qty : null;
    const grossProfit = totalCost !== null ? revenue - totalCost : null;
    const marginPct = avgSell > 0 && avgCost !== null ? ((avgSell - avgCost) / avgSell) * 100 : null;
    return {
      productId: r.product_id, productName: r.product_name, productCode: r.product_code,
      hsCode: r.hs_code,
      totalQtySold: qty, uom: r.uom,
      totalRevenue: revenue, avgSellingPrice: avgSell,
      avgLandedCost: avgCost, totalCost,
      grossProfit, marginPct: marginPct !== null ? Math.round(marginPct * 10) / 10 : null,
      invoiceCount: r.invoice_count,
      hasCostData: avgCost !== null,
    };
  });

  const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
  const productsWithCost = products.filter((p) => p.hasCostData);
  const totalCost = productsWithCost.reduce((s, p) => s + (p.totalCost ?? 0), 0);
  const totalProfit = productsWithCost.reduce((s, p) => s + (p.grossProfit ?? 0), 0);
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return NextResponse.json({
    products,
    summary: {
      totalRevenue, totalCost, totalProfit, overallMargin: Math.round(overallMargin * 10) / 10,
      productCount: products.length, productsWithCostData: productsWithCost.length,
    },
    period: { from: from ?? ytdStart, to: to ?? new Date().toISOString().split('T')[0] },
  });
}
