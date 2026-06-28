import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CustomerListClient } from '@/components/customers/customer-list-client';

export const revalidate = 0;

const TYPE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer', trader: 'Trader', distributor: 'Distributor',
  retailer: 'Retailer', government: 'Government',
};

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const rows = await tdb.select().from(customers).orderBy(customers.name);

  const total = rows.length;
  const active = rows.filter((r) => r.isActive).length;
  const withCredit = rows.filter((r) => parseFloat(r.creditLimitPkr ?? '0') > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage buyer master data, credit limits, and pricing</p>
        </div>
        <Link href="/sales/customers/new">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" />New Customer
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Customers', value: total },
          { label: 'Active', value: active },
          { label: 'With Credit Limit', value: withCredit },
        ].map((s) => (
          <div key={s.label} className="bg-white border rounded-xl p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <CustomerListClient rows={rows} />
    </div>
  );
}
