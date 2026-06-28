import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { chartOfAccounts } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AccountsPanel } from '@/components/finance/accounts-panel';

export const revalidate = 0;

export default async function ChartOfAccountsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const accounts = await tdb.select().from(chartOfAccounts)
    .orderBy(asc(chartOfAccounts.sortOrder), asc(chartOfAccounts.code));

  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.isActive).length,
    groups: accounts.filter((a) => a.isGroup).length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Chart of Accounts</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {stats.active} active · {stats.groups} group headers · {stats.total} total
        </p>
      </div>

      <AccountsPanel initialAccounts={accounts} />
    </div>
  );
}
