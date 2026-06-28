import { db } from '@/db';
import { shippingLines } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { ShippingLineActions } from '@/components/admin/shipping-line-actions';

export default async function ShippingLinesPage() {
  const all = await db.select().from(shippingLines).orderBy(sql`name asc`);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shipping Lines</h1>
          <p className="text-sm text-slate-500 mt-0.5">Container shipping carriers with default free days</p>
        </div>
        <ShippingLineActions mode="create" />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">SCAC</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Free Days</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Detention Days</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {all.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No shipping lines configured.</td></tr>
              ) : (
                all.map((sl) => (
                  <tr key={sl.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{sl.code}</td>
                    <td className="px-4 py-3 text-slate-700">{sl.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{sl.scac ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{sl.freeDays ?? 14}</td>
                    <td className="px-4 py-3 text-right">{sl.detentionFreeDays ?? 14}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{sl.contactEmail ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${sl.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {sl.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ShippingLineActions mode="edit" line={sl} /></td>
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
