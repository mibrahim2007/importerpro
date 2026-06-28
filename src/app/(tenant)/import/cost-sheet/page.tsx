import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { landedCosts, shipments } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { CalculatorIcon, Plus, CheckCircle2, FileText } from 'lucide-react';

const fmt = (v: string | null | undefined) =>
  v ? `PKR ${parseFloat(v).toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : '—';

export const revalidate = 0;

export default async function CostSheetListPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [sheets, shipmentRows] = await Promise.all([
    tdb.select().from(landedCosts).orderBy(desc(landedCosts.createdAt)),
    tdb.select({ id: shipments.id, shipmentNo: shipments.shipmentNo }).from(shipments),
  ]);

  const shipMap = Object.fromEntries(shipmentRows.map((s) => [s.id, s.shipmentNo]));

  const stats = {
    total: sheets.length,
    draft: sheets.filter((s) => s.status === 'draft').length,
    finalized: sheets.filter((s) => s.status === 'finalized').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Landed Cost Sheets</h1>
          <p className="text-sm text-slate-500 mt-0.5">Import P&L per consignment — CIF + duties + port + LC + inland charges</p>
        </div>
        <Link href="/import/cost-sheet/new">
          <button className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Cost Sheet
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'All Sheets', value: stats.total, icon: CalculatorIcon, color: 'text-slate-700' },
          { label: 'Draft', value: stats.draft, icon: FileText, color: 'text-amber-600' },
          { label: 'Finalized', value: stats.finalized, icon: CheckCircle2, color: 'text-green-600' },
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

      {sheets.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          <CalculatorIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No cost sheets yet. Create one after clearing customs to compute your landed cost per unit.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Sheet No.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Shipment</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">CIF (PKR)</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Duty & Tax</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Total Landed</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Per Unit</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/import/cost-sheet/${s.id}`} className="font-mono text-teal-600 hover:underline text-sm">
                          {s.costSheetNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{shipMap[s.shipmentId] ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.cifValuePkr)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.totalDutyTaxesPkr)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(s.totalLandedCostPkr)}</td>
                      <td className="px-4 py-3 text-right text-teal-700 font-medium">
                        {s.landedCostPerUnitPkr ? `PKR ${parseFloat(s.landedCostPerUnitPkr).toLocaleString('en-PK', { maximumFractionDigits: 2 })}/${s.qtyUom ?? 'unit'}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {s.status}
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
