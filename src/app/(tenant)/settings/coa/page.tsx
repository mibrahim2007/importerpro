import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { chartOfAccounts } from '@/db/schema';
import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { CoaActions } from '@/components/settings/coa-actions';

const typeColors: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-green-100 text-green-700',
  cogs: 'bg-orange-100 text-orange-700',
  expense: 'bg-amber-100 text-amber-700',
};

export default async function CoaPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const accounts = await tdb.select().from(chartOfAccounts).orderBy(asc(chartOfAccounts.sortOrder), asc(chartOfAccounts.code));

  // Group by account type
  const groups = accounts.reduce<Record<string, typeof accounts>>((acc, a) => {
    acc[a.accountType] = acc[a.accountType] ?? [];
    acc[a.accountType].push(a);
    return acc;
  }, {});

  const groupOrder = ['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense'];
  const groupLabels: Record<string, string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue',
    cogs: 'Cost of Goods Sold',
    expense: 'Operating Expenses',
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Chart of Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pre-seeded Pakistan COA — customise as needed</p>
        </div>
        <CoaActions mode="create" />
      </div>

      <div className="space-y-4">
        {groupOrder.map((type) => {
          const accs = groups[type] ?? [];
          if (accs.length === 0) return null;
          return (
            <Card key={type}>
              <div className="px-4 py-2.5 border-b bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${typeColors[type]}`}>{type.toUpperCase()}</span>
                  <span className="text-sm font-semibold text-slate-700">{groupLabels[type]}</span>
                </div>
                <span className="text-xs text-slate-400">{accs.length} accounts</span>
              </div>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {accs.map((acc) => (
                      <tr key={acc.id} className={`border-b hover:bg-slate-50 ${acc.isGroup ? 'bg-slate-50/50' : ''}`}>
                        <td className="px-4 py-2.5 w-24">
                          <span className={`font-mono text-sm ${acc.isGroup ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                            {acc.code}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 ${acc.isGroup ? 'font-semibold text-slate-900' : 'text-slate-700'} ${acc.parentCode ? 'pl-8' : ''}`}>
                          {acc.name}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400 text-xs">
                          {acc.currency}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${acc.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                            {acc.isActive ? 'Active' : 'Off'}
                          </span>
                          {acc.isSystem && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-400">System</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {!acc.isSystem && <CoaActions mode="edit" account={acc} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
