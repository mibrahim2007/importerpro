import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { journalEntries } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Plus, CheckCircle2, FileText } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-500',
  posted:   'bg-green-100 text-green-700',
  reversed: 'bg-orange-100 text-orange-600',
};

export const revalidate = 0;

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const entries = await tdb.select().from(journalEntries).orderBy(desc(journalEntries.jeDate));

  const stats = {
    total: entries.length,
    draft: entries.filter((e) => e.status === 'draft').length,
    posted: entries.filter((e) => e.status === 'posted').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Journal Entries</h1>
          <p className="text-sm text-slate-500 mt-0.5">Double-entry bookkeeping — manual and auto-generated entries</p>
        </div>
        <Link href="/finance/journal/new">
          <button className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Entry
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Entries', value: stats.total, icon: BookOpen, color: 'text-slate-600' },
          { label: 'Draft', value: stats.draft, icon: FileText, color: 'text-amber-600' },
          { label: 'Posted', value: stats.posted, icon: CheckCircle2, color: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No journal entries yet.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">JE No.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Ref</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Total Debit</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/finance/journal/${e.id}`} className="font-mono text-teal-600 hover:underline text-sm">{e.jeNo}</Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(e.jeDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{e.description}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{e.reference ?? (e.referenceType !== 'manual' ? e.referenceType : '—')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        PKR {parseFloat(e.totalDebit ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[e.status ?? 'draft']}`}>
                          {e.status ?? 'draft'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
