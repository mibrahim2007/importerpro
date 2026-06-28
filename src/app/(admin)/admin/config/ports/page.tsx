import { db } from '@/db';
import { ports } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { PortActions } from '@/components/admin/port-actions';

const DEFAULT_PORTS = [
  { code: 'PKKHI', name: 'Karachi Port Trust (KPT)', type: 'sea', city: 'Karachi' },
  { code: 'PKQCT', name: 'Qasim International Container Terminal (QICT)', type: 'sea', city: 'Karachi' },
  { code: 'PKPCT', name: 'Pakistan International Container Terminal (PICT)', type: 'sea', city: 'Karachi' },
  { code: 'PKSAPT', name: 'South Asia Port Terminal (SAPT)', type: 'sea', city: 'Karachi' },
  { code: 'PKLHE-DP', name: 'Lahore Dry Port', type: 'dry', city: 'Lahore' },
  { code: 'PKSIALK-DP', name: 'Sialkot Dry Port', type: 'dry', city: 'Sialkot' },
  { code: 'PKFSD-DP', name: 'Faisalabad Dry Port', type: 'dry', city: 'Faisalabad' },
  { code: 'PKPEW-DP', name: 'Peshawar Dry Port', type: 'dry', city: 'Peshawar' },
];

export default async function PortsPage() {
  const allPorts = await db.select().from(ports).orderBy(sql`type asc, name asc`);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Port Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sea ports, air ports, and dry ports in Pakistan</p>
        </div>
        <PortActions mode="create" />
      </div>

      {allPorts.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <strong>Seed defaults:</strong> Click &ldquo;Add Port&rdquo; to add ports, or seed the defaults listed below.
          {DEFAULT_PORTS.map((p) => (
            <span key={p.code} className="ml-2 font-mono text-xs">{p.code}</span>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">City</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {allPorts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No ports configured yet.</td></tr>
              ) : (
                allPorts.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{p.code}</td>
                    <td className="px-4 py-3 text-slate-700">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.type === 'sea' ? 'bg-blue-100 text-blue-700' : p.type === 'air' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.city ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><PortActions mode="edit" port={p} /></td>
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
