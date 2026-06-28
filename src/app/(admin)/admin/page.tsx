import { db } from '@/db';
import { tenants, users, tenantUsers } from '@/db/schema';
import { eq, count, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const [tenantStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where status = 'active')`,
      suspended: sql<number>`count(*) filter (where status = 'suspended')`,
      trial: sql<number>`count(*) filter (where status = 'trial')`,
    })
    .from(tenants);

  const [userCount] = await db.select({ total: count() }).from(users);

  const recentTenants = await db
    .select()
    .from(tenants)
    .orderBy(sql`created_at desc`)
    .limit(8);

  const planColors: Record<string, string> = {
    starter: 'bg-slate-100 text-slate-700',
    growth: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-violet-100 text-violet-700',
    custom: 'bg-amber-100 text-amber-700',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
    trial: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Super Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform overview — all tenants</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{tenantStats?.total ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{tenantStats?.active ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Suspended</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{tenantStats?.suspended ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Platform Users</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{userCount?.total ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tenants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Recent Tenants</CardTitle>
          <Link href="/admin/tenants" className="text-xs text-violet-600 hover:underline">
            View all →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Slug</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">NTN</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Plan</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No tenants yet.{' '}
                    <Link href="/admin/tenants/new" className="text-violet-600 hover:underline">
                      Create the first tenant →
                    </Link>
                  </td>
                </tr>
              ) : (
                recentTenants.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${t.id}`} className="font-medium text-slate-900 hover:text-violet-600">
                        {t.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{t.slug}</td>
                    <td className="px-4 py-3 text-slate-500">{t.ntn ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${planColors[t.plan]}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-PK') : '—'}
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
