import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { journalEntries, journalLines } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { JeStatusActions } from '@/components/finance/je-status-actions';

const STATUS_BADGE: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-500',
  posted:   'bg-green-100 text-green-700',
  reversed: 'bg-orange-100 text-orange-600',
};

export const revalidate = 0;

export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[entry], lines] = await Promise.all([
    tdb.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1),
    tdb.select().from(journalLines).where(eq(journalLines.jeId, id)).orderBy(asc(journalLines.sortOrder)),
  ]);

  if (!entry) notFound();

  const debitLines = lines.filter((l) => parseFloat(l.debit ?? '0') > 0);
  const creditLines = lines.filter((l) => parseFloat(l.credit ?? '0') > 0);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance/journal">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-mono font-bold text-slate-900">{entry.jeNo}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[entry.status ?? 'draft']}`}>
              {entry.status ?? 'draft'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{entry.description}</p>
        </div>
      </div>

      <JeStatusActions jeId={id} status={entry.status ?? 'draft'} />

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Entry Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Date', value: new Date(entry.jeDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) },
                { label: 'Reference', value: entry.reference ?? (entry.referenceType !== 'manual' ? entry.referenceType : '—') },
                { label: 'Posted At', value: entry.postedAt ? new Date(entry.postedAt).toLocaleString('en-PK') : '—' },
                { label: 'Reversed At', value: entry.reversedAt ? new Date(entry.reversedAt).toLocaleString('en-PK') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Ledger */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ledger Lines</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-2 font-medium text-slate-500">Account</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-500">Narration</th>
                    <th className="text-right px-4 py-2 font-medium text-green-600">Debit (Dr)</th>
                    <th className="text-right px-4 py-2 font-medium text-red-500">Credit (Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-slate-500">{l.accountCode}</span>
                        {l.accountName && <span className="ml-2 text-slate-700">{l.accountName}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{l.description ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-green-700">
                        {parseFloat(l.debit ?? '0') > 0 ? parseFloat(l.debit!).toLocaleString('en-PK', { minimumFractionDigits: 2 }) : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-red-600">
                        {parseFloat(l.credit ?? '0') > 0 ? parseFloat(l.credit!).toLocaleString('en-PK', { minimumFractionDigits: 2 }) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 font-semibold text-slate-600">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-green-700 font-mono">
                      {parseFloat(entry.totalDebit ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-red-600 font-mono">
                      {parseFloat(entry.totalCredit ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Balance Check</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-400">Total Dr</span>
                  <span className="text-white font-mono">{parseFloat(entry.totalDebit ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">Total Cr</span>
                  <span className="text-white font-mono">{parseFloat(entry.totalCredit ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={`flex justify-between pt-2 border-t border-slate-600 ${Math.abs(parseFloat(entry.totalDebit ?? '0') - parseFloat(entry.totalCredit ?? '0')) < 0.01 ? 'text-green-300' : 'text-red-300'}`}>
                  <span>Difference</span>
                  <span className="font-mono">{Math.abs(parseFloat(entry.totalDebit ?? '0') - parseFloat(entry.totalCredit ?? '0')).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
