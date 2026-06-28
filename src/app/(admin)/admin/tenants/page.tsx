import { db } from '@/db';
import { tenants } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { TenantActions } from '@/components/admin/tenant-actions';

const planColors: Record<string, string> = {
  starter: 'bg-slate-100 text-slate-600',
  growth: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-violet-100 text-violet-700',
  custom: 'bg-amber-100 text-amber-700',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  trial: 'bg-amber-100 text-amber-700',
};

export default async function TenantsPage() {
  const allTenants = await db
    .select()
    .from(tenants)
    .orderBy(sql`created_at desc`);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tenants</h1>
          <p className="text-sm text-slate-500 mt-0.5">{allTenants.length} tenant{allTenants.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Link href="/admin/tenants/new">
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="h-4 w-4 mr-1.5" />
            New Tenant
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Slug / Schema</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">NTN</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Plan</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Created</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No tenants yet.{' '}
                    <Link href="/admin/tenants/new" className="text-violet-600 hover:underline">
                      Create the first tenant →
                    </Link>
                  </td>
                </tr>
              ) : (
                allTenants.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${t.id}`} className="font-medium text-slate-900 hover:text-violet-600">
                        {t.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500">{t.slug}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{t.ntn ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{t.contactPerson ?? '—'}</div>
                      <div className="text-slate-400 text-xs">{t.contactEmail ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${planColors[t.plan]}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-PK') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <TenantActions tenantId={t.id} status={t.status} slug={t.slug} />
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
