import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers, salesInvoices } from '@/db/schema';
import { eq, and, not, inArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { PaymentForm } from '@/components/sales/payment-form';

export const revalidate = 0;

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { customerId } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const allCustomers = await tdb.select({
    id: customers.id, name: customers.name, code: customers.code,
    preferredPaymentMode: customers.preferredPaymentMode, bankName: customers.bankName,
  }).from(customers).where(eq(customers.isActive, true));

  // Fetch open invoices for pre-selected customer
  let openInvoices: any[] = [];
  if (customerId) {
    openInvoices = await tdb.select({
      id: salesInvoices.id, invoiceNo: salesInvoices.invoiceNo,
      invoiceDate: salesInvoices.invoiceDate, dueDate: salesInvoices.dueDate,
      grandTotalPkr: salesInvoices.grandTotalPkr, balancePkr: salesInvoices.balancePkr,
      status: salesInvoices.status,
    })
    .from(salesInvoices)
    .where(
      and(
        eq(salesInvoices.customerId, customerId),
        not(inArray(salesInvoices.status, ['draft', 'cancelled', 'fully_paid'] as any[])),
        sql`${salesInvoices.balancePkr} > 0`,
      )
    )
    .orderBy(salesInvoices.dueDate);
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New Payment Receipt</h1>
        <p className="text-sm text-slate-500">Record a customer payment and allocate to open invoices</p>
      </div>
      <PaymentForm customers={allCustomers} prefillCustomerId={customerId} initialOpenInvoices={openInvoices} />
    </div>
  );
}
