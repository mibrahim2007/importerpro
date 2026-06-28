import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customerReceipts, customers, salesInvoices } from '@/db/schema';
import { eq, desc, and, not, inArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PaymentListClient } from '@/components/sales/payment-list-client';

export const revalidate = 0;

export default async function CustomerPaymentsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [receipts, agingRows] = await Promise.all([
    tdb.select({
      id: customerReceipts.id, receiptNo: customerReceipts.receiptNo,
      receiptDate: customerReceipts.receiptDate, status: customerReceipts.status,
      totalAmountPkr: customerReceipts.totalAmountPkr,
      allocatedAmountPkr: customerReceipts.allocatedAmountPkr,
      unallocatedAmountPkr: customerReceipts.unallocatedAmountPkr,
      paymentMethod: customerReceipts.paymentMethod,
      chequeNo: customerReceipts.chequeNo, chequeDueDate: customerReceipts.chequeDueDate,
      bankName: customerReceipts.bankName, referenceNo: customerReceipts.referenceNo,
      createdAt: customerReceipts.createdAt,
      customerName: customers.name, customerId: customerReceipts.customerId,
    })
    .from(customerReceipts)
    .leftJoin(customers, eq(customers.id, customerReceipts.customerId))
    .orderBy(desc(customerReceipts.receiptDate)),

    tdb.select({
      balancePkr: salesInvoices.balancePkr,
      dueDate: salesInvoices.dueDate,
      status: salesInvoices.status,
    })
    .from(salesInvoices)
    .where(
      and(
        not(inArray(salesInvoices.status, ['draft', 'cancelled', 'fully_paid'] as any[])),
        sql`${salesInvoices.balancePkr} > 0`,
      )
    ),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const totalReceived = receipts.filter((r) => r.status === 'cleared')
    .reduce((s, r) => s + parseFloat(String(r.totalAmountPkr ?? '0')), 0);
  const pdcPending = receipts.filter((r) => r.status === 'pending').length;
  const pdcValue = receipts.filter((r) => r.status === 'pending')
    .reduce((s, r) => s + parseFloat(String(r.totalAmountPkr ?? '0')), 0);
  const totalReceivable = agingRows.reduce((s, r) => s + parseFloat(String(r.balancePkr ?? '0')), 0);
  const overdueBalance = agingRows.filter((r) => r.dueDate && r.dueDate < today)
    .reduce((s, r) => s + parseFloat(String(r.balancePkr ?? '0')), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Customer Payments</h1>
          <p className="text-sm text-slate-500">Payment receipts, PDC register, and receivables aging</p>
        </div>
        <Link href="/sales/payments/new">
          <Button className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1.5 h-4 w-4" />New Receipt</Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Received (Cleared)', value: `PKR ${totalReceived.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, sub: `${receipts.filter((r) => r.status === 'cleared').length} receipts`, color: 'text-green-700' },
          { label: 'PDC Cheques Pending', value: pdcPending, sub: `PKR ${pdcValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, color: 'text-amber-600' },
          { label: 'Total Receivable', value: `PKR ${totalReceivable.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, sub: `${agingRows.length} open invoices`, color: 'text-teal-700' },
          { label: 'Overdue Balance', value: `PKR ${overdueBalance.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, sub: 'past due date', color: 'text-red-600' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <PaymentListClient initialReceipts={receipts} today={today} />
    </div>
  );
}
