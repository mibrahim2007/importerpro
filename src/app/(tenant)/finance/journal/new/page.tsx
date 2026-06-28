import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { chartOfAccounts } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { JournalEntryForm } from '@/components/finance/journal-entry-form';

export default async function NewJournalEntryPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const accounts = await tdb.select({ code: chartOfAccounts.code, name: chartOfAccounts.name, accountType: chartOfAccounts.accountType })
    .from(chartOfAccounts).where(eq(chartOfAccounts.isActive, true)).orderBy(asc(chartOfAccounts.sortOrder));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance/journal">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Journal Entry</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manual double-entry — debits must equal credits</p>
        </div>
      </div>
      <JournalEntryForm accounts={accounts} />
    </div>
  );
}
