import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers, customerAddresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { CustomerForm } from '@/components/master/customer-form';
import { CustomerAddresses } from '@/components/master/customer-addresses';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[customer], addresses] = await Promise.all([
    tdb.select().from(customers).where(eq(customers.id, id)).limit(1),
    tdb.select().from(customerAddresses).where(eq(customerAddresses.customerId, id)),
  ]);

  if (!customer) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit Customer</h1>
        <p className="text-sm text-slate-500 mt-0.5 font-mono">{customer.code ?? customer.name}</p>
      </div>
      <CustomerForm customer={customer} />
      <CustomerAddresses customerId={id} addresses={addresses} />
    </div>
  );
}
