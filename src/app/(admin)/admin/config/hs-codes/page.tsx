import { db } from '@/db';
import { hsCodes } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import { HsCodeActions } from '@/components/admin/hs-code-actions';

export default async function HsCodesPage() {
  const codes = await db.select().from(hsCodes).orderBy(sql`hs_code asc`).limit(200);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">HS Code Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pakistan Customs Tariff — 8-digit HS codes with duty rates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1.5" />
            Import CSV
          </Button>
          <HsCodeActions mode="create" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">HS Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Description</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">CD%</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">ACD%</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">RD%</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">ST%</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">WHT%</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">AT%</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    No HS codes yet. Add them manually or import a CSV.
                  </td>
                </tr>
              ) : (
                codes.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{c.hsCode}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{c.description}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.cdPct}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.acdPct}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.rdPct}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.stPct}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.whtPct}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.atPct}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <HsCodeActions mode="edit" code={c} />
                    </td>
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
