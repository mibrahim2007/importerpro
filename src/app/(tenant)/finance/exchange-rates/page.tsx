import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { exchangeRates } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ExchangeRatesPanel } from '@/components/finance/exchange-rates-panel';

export const revalidate = 0;

export default async function ExchangeRatesPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const rates = await tdb.select().from(exchangeRates).orderBy(desc(exchangeRates.rateDate));

  // Latest rate per currency
  const latestMap: Record<string, typeof rates[0]> = {};
  for (const r of rates) {
    if (!latestMap[r.currency]) latestMap[r.currency] = r;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Exchange Rates</h1>
        <p className="text-sm text-slate-500 mt-0.5">PKR rates for foreign currency bills and payments (SBP reference rates)</p>
      </div>

      {/* Current rates */}
      <div className="grid grid-cols-4 gap-3">
        {['USD', 'EUR', 'CNY', 'AED'].map((ccy) => {
          const r = latestMap[ccy];
          return (
            <Card key={ccy}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">{ccy} / PKR</p>
                <p className="text-2xl font-bold text-slate-800">{r ? parseFloat(r.rate).toFixed(2) : '—'}</p>
                {r && <p className="text-xs text-slate-400 mt-1">{new Date(r.rateDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ExchangeRatesPanel rates={rates} />
    </div>
  );
}
