import { db } from '@/db';
import { currencies } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyActions } from '@/components/admin/currency-actions';

export default async function CurrenciesPage() {
  const all = await db.select().from(currencies).orderBy(sql`code asc`);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Currency Rates</h1>
          <p className="text-sm text-slate-500 mt-0.5">Exchange rates used for LC cost calculations and duty assessments</p>
        </div>
        <CurrencyActions mode="create" />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Rate to USD</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Rate to PKR</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Updated</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {all.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No currencies configured.</td></tr>
              ) : (
                all.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{c.code}</td>
                    <td className="px-4 py-3 text-slate-700">{c.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{c.rateToUsd}</td>
                    <td className="px-4 py-3 text-right font-mono">{c.rateToPkr}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('en-PK') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><CurrencyActions mode="edit" currency={c} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
