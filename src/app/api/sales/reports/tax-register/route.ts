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
  const year = parseInt(p.get('year') ?? String(new Date().getFullYear()));
  const month = parseInt(p.get('month') ?? String(new Date().getMonth() + 1));
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(year, month, 1).toISOString().split('T')[0];

  const rows = await tdb.execute(sql`
    SELECT
      sil.hs_code,
      COALESCE(p.name, sil.description)          AS description,
      sil.sales_tax_pct::numeric                  AS tax_rate,
      SUM(sil.qty)::numeric                       AS total_qty,
      MAX(sil.uom)                                AS uom,
      SUM(sil.taxable_value_pkr)::numeric         AS taxable_value,
      SUM(sil.sales_tax_pkr)::numeric             AS sales_tax,
      COUNT(DISTINCT si.id)::integer              AS invoice_count,
      ARRAY_AGG(DISTINCT si.invoice_no ORDER BY si.invoice_no) AS invoice_nos
    FROM sales_invoice_lines sil
    JOIN sales_invoices si ON si.id = sil.invoice_id
    LEFT JOIN products p ON p.id = sil.product_id
    WHERE si.status NOT IN ('draft', 'cancelled')
      AND si.invoice_date::date >= ${fromDate}::date
      AND si.invoice_date::date < ${toDate}::date
    GROUP BY sil.hs_code, COALESCE(p.name, sil.description), sil.sales_tax_pct
    ORDER BY sil.sales_tax_pct DESC, taxable_value DESC
  `);

  const lines = rows as any[];

  // Summary by tax rate
  const byRate: Record<string, { taxableValue: number; salesTax: number }> = {};
  for (const r of lines) {
    const rate = String(parseFloat(r.tax_rate));
    if (!byRate[rate]) byRate[rate] = { taxableValue: 0, salesTax: 0 };
    byRate[rate].taxableValue += parseFloat(r.taxable_value ?? '0');
    byRate[rate].salesTax += parseFloat(r.sales_tax ?? '0');
  }

  const grandTaxable = lines.reduce((s, r) => s + parseFloat(r.taxable_value ?? '0'), 0);
  const grandTax = lines.reduce((s, r) => s + parseFloat(r.sales_tax ?? '0'), 0);

  return NextResponse.json({
    period: { year, month, from: fromDate, to: toDate },
    lines: lines.map((r) => ({
      hsCode: r.hs_code ?? '—',
      description: r.description,
      taxRate: parseFloat(r.tax_rate),
      totalQty: parseFloat(r.total_qty ?? '0'),
      uom: r.uom,
      taxableValue: parseFloat(r.taxable_value ?? '0'),
      salesTax: parseFloat(r.sales_tax ?? '0'),
      invoiceCount: r.invoice_count,
      invoiceNos: r.invoice_nos ?? [],
    })),
    byRate,
    grandTaxable,
    grandTax,
  });
}
