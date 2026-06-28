import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { salesInvoices, customers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { InvoiceListClient } from '@/components/sales/invoice-list-client';

export const revalidate = 0;

export default async function InvoicesPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb.select({
    id: salesInvoices.id, invoiceNo: salesInvoices.invoiceNo,
    invoiceDate: salesInvoices.invoiceDate, invoiceType: salesInvoices.invoiceType,
    status: salesInvoices.status, dueDate: salesInvoices.dueDate,
    grandTotalPkr: salesInvoices.grandTotalPkr, balancePkr: salesInvoices.balancePkr,
    amountReceivedPkr: salesInvoices.amountReceivedPkr,
    fbrStatus: salesInvoices.fbrStatus, fbrInvoiceNo: salesInvoices.fbrInvoiceNo,
    createdAt: salesInvoices.createdAt, postedAt: salesInvoices.postedAt,
    dcId: salesInvoices.dcId, soId: salesInvoices.soId,
    customerName: customers.name, customerId: salesInvoices.customerId,
  })
  .from(salesInvoices)
  .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
  .orderBy(desc(salesInvoices.createdAt));

  const total = rows.length;
  const draft = rows.filter((r) => r.status === 'draft').length;
  const unpaid = rows.filter((r) => ['posted', 'sent', 'partially_paid', 'overdue'].includes(r.status ?? '')).length;
  const overdue = rows.filter((r) => r.status === 'overdue' || (
    ['posted', 'sent', 'partially_paid'].includes(r.status ?? '') &&
    r.dueDate && r.dueDate < new Date().toISOString().split('T')[0]
  )).length;
  const receivable = rows.filter((r) => !['draft', 'cancelled', 'fully_paid'].includes(r.status ?? ''))
    .reduce((s, r) => s + parseFloat(String(r.balancePkr ?? '0')), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sales Invoices</h1>
          <p className="text-sm text-slate-500">FBR-compliant tax invoices and payment tracking</p>
        </div>
        <Link href="/sales/invoices/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-1.5 h-4 w-4" />New Invoice
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Invoices', value: total, sub: 'all time', color: 'text-slate-700' },
          { label: 'Draft', value: draft, sub: 'not yet posted', color: 'text-slate-500' },
          { label: 'Overdue', value: overdue, sub: 'past due date', color: 'text-red-600' },
          {
            label: 'Total Receivable',
            value: `PKR ${receivable.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`,
            sub: `${unpaid} unpaid invoice${unpaid !== 1 ? 's' : ''}`, color: 'text-teal-700',
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <InvoiceListClient initialRows={rows} />
    </div>
  );
}
