import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { SalesSummaryClient } from '@/components/sales/reports/sales-summary-client';

export const revalidate = 0;

export default async function SalesSummaryPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const allCustomers = await tdb.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.isActive, true));

  return <SalesSummaryClient customers={allCustomers} />;
}
