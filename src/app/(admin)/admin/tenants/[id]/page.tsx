import { db } from '@/db';
import { tenants, tenantUsers, users } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, Users, Calendar, Database, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { TenantStatusButton } from '@/components/admin/tenant-status-button';

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

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) notFound();

  const [memberCount] = await db
    .select({ count: count() })
    .from(tenantUsers)
    .where(eq(tenantUsers.tenantId, id));

  const members = await db
    .select({ tenantUser: tenantUsers, user: users })
    .from(tenantUsers)
    .innerJoin(users, eq(tenantUsers.userId, users.id))
    .where(eq(tenantUsers.tenantId, id))
    .limit(20);

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{tenant.companyName}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${planColors[tenant.plan]}`}>
              {tenant.plan}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[tenant.status]}`}>
              {tenant.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-mono mt-0.5">{tenant.slug}</p>
        </div>
        <TenantStatusButton tenantId={id} currentStatus={tenant.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Company Info */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Company Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500">NTN</span>
              <span className="font-medium">{tenant.ntn ?? '—'}</span>
              <span className="text-slate-500">STRN</span>
              <span className="font-medium">{tenant.strn ?? '—'}</span>
              <span className="text-slate-500">Schema</span>
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{tenant.schemaName}</span>
              <span className="text-slate-500">Created</span>
              <span>{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('en-PK') : '—'}</span>
            </div>
            {tenant.businessAddress && (
              <div className="pt-2 border-t">
                <p className="text-slate-500 text-xs mb-1">Address</p>
                <p>{tenant.businessAddress}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact & Stats */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Contact & Usage</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500">Contact</span>
              <span className="font-medium">{tenant.contactPerson ?? '—'}</span>
              <span className="text-slate-500">Email</span>
              <span>{tenant.contactEmail ?? '—'}</span>
              <span className="text-slate-500">Phone</span>
              <span>{tenant.contactPhone ?? '—'}</span>
              <span className="text-slate-500">Active Users</span>
              <span className="font-bold text-slate-900">{memberCount?.count ?? 0}</span>
            </div>
            {tenant.status === 'suspended' && tenant.suspendedReason && (
              <div className="pt-2 border-t">
                <p className="text-xs text-red-600 font-medium">Suspended reason:</p>
                <p className="text-red-700">{tenant.suspendedReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Users ({memberCount?.count ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No users yet</td>
                </tr>
              ) : (
                members.map(({ tenantUser, user }) => (
                  <tr key={tenantUser.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{user.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs capitalize">
                        {tenantUser.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tenantUser.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {tenantUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {tenantUser.createdAt ? new Date(tenantUser.createdAt).toLocaleDateString('en-PK') : '—'}
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
