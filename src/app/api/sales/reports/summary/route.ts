import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/db';
import { salesInvoices, salesInvoiceLines, customers, products } from '@/db/schema';
import { eq, and, sql, not, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tdb = await getTenantDb(session.user.tenantSlug);

  const p = req.nextUrl.searchParams;
  const from = p.get('from');
  const to = p.get('to');
  const customerId = p.get('customerId');
  const statusFilter = p.get('status');

  const rows = await tdb.execute(sql`
    SELECT
      si.invoice_no,
      si.invoice_date,
      si.due_date,
      si.status,
      c.name  AS customer_name,
      c.ntn   AS customer_ntn,
      p.name  AS product_name,
      p.code  AS product_code,
      sil.hs_code,
      sil.qty,
      sil.uom,
      sil.unit_price_pkr,
      sil.discount_pkr,
      sil.taxable_value_pkr,
      sil.sales_tax_pct,
      sil.sales_tax_pkr,
      si.grand_total_pkr,
      si.amount_received_pkr,
      si.balance_pkr,
      si.fbr_invoice_no,
      si.id AS invoice_id
    FROM sales_invoices si
    LEFT JOIN customers c ON c.id = si.customer_id
    LEFT JOIN sales_invoice_lines sil ON sil.invoice_id = si.id
    LEFT JOIN products p ON p.id = sil.product_id
    WHERE si.status NOT IN ('draft')
    ${from ? sql`AND si.invoice_date >= ${from}::date` : sql``}
    ${to ? sql`AND si.invoice_date <= ${to}::date` : sql``}
    ${customerId ? sql`AND si.customer_id = ${customerId}::uuid` : sql``}
    ${statusFilter && statusFilter !== 'all' ? sql`AND si.status = ${statusFilter}` : sql``}
    ORDER BY si.invoice_date DESC, si.invoice_no, sil.sort_order
  `);

  const lines = rows.rows as any[];

  // Aggregate totals
  const uniqueInvoiceIds = new Set(lines.map((r) => r.invoice_id));
  const invoiceTotals = new Map<string, any>();
  for (const r of lines) {
    if (!invoiceTotals.has(r.invoice_id)) {
      invoiceTotals.set(r.invoice_id, {
        grandTotal: parseFloat(r.grand_total_pkr ?? '0'),
        received: parseFloat(r.amount_received_pkr ?? '0'),
        balance: parseFloat(r.balance_pkr ?? '0'),
      });
    }
  }

  const totalRevenue = Array.from(invoiceTotals.values()).reduce((s, v) => s + v.grandTotal, 0);
  const totalTaxableValue = lines.reduce((s, r) => s + parseFloat(r.taxable_value_pkr ?? '0'), 0);
  const totalSalesTax = lines.reduce((s, r) => s + parseFloat(r.sales_tax_pkr ?? '0'), 0);
  const totalReceived = Array.from(invoiceTotals.values()).reduce((s, v) => s + v.received, 0);
  const totalBalance = Array.from(invoiceTotals.values()).reduce((s, v) => s + v.balance, 0);

  return NextResponse.json({
    lines,
    summary: {
      invoiceCount: uniqueInvoiceIds.size,
      totalRevenue,
      totalTaxableValue,
      totalSalesTax,
      totalReceived,
      totalBalance,
    },
  });
}
