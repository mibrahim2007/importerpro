import { auth } from '@/lib/auth/config';
import { db } from '@/db';
import { tenantUsers, users, tenants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { InviteUserDialog } from '@/components/settings/invite-user-dialog';
import { UserRoleActions } from '@/components/settings/user-role-actions';
import { Shield } from 'lucide-react';

const ROLES = [
  { value: 'tenant_admin', label: 'Tenant Admin', desc: 'Full access to all modules and settings' },
  { value: 'procurement_manager', label: 'Procurement Manager', desc: 'Indent, RFQ, PO — approve and edit' },
  { value: 'procurement_officer', label: 'Procurement Officer', desc: 'Create and submit indents, RFQs' },
  { value: 'finance_manager', label: 'Finance Manager', desc: 'LC, payments, COA, financial reports' },
  { value: 'warehouse_manager', label: 'Warehouse Manager', desc: 'GRN, stock movement, inventory' },
  { value: 'sales_manager', label: 'Sales Manager', desc: 'Sales orders, customers, dispatch' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only access to all modules' },
];

const roleColors: Record<string, string> = {
  tenant_admin: 'bg-violet-100 text-violet-700',
  procurement_manager: 'bg-blue-100 text-blue-700',
  procurement_officer: 'bg-sky-100 text-sky-700',
  finance_manager: 'bg-emerald-100 text-emerald-700',
  warehouse_manager: 'bg-amber-100 text-amber-700',
  sales_manager: 'bg-orange-100 text-orange-700',
  viewer: 'bg-slate-100 text-slate-600',
};

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user.tenantId) redirect('/login');

  const members = await db
    .select({ tenantUser: tenantUsers, user: users })
    .from(tenantUsers)
    .innerJoin(users, eq(tenantUsers.userId, users.id))
    .where(eq(tenantUsers.tenantId, session.user.tenantId));

  const isAdmin = session.user.role === 'tenant_admin';

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users & Roles</h1>
          <p className="text-sm text-slate-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''} in this workspace</p>
        </div>
        {isAdmin && <InviteUserDialog roles={ROLES} />}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Joined</th>
                {isAdmin && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {members.map(({ tenantUser, user }) => (
                <tr key={tenantUser.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-semibold">
                        {(user.name ?? user.email)[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{user.name ?? '—'}</span>
                      {user.id === session.user.id && (
                        <span className="text-xs text-slate-400">(you)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${roleColors[tenantUser.role] ?? 'bg-slate-100 text-slate-600'}`}>
                      {tenantUser.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${tenantUser.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {tenantUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {tenantUser.createdAt ? new Date(tenantUser.createdAt).toLocaleDateString('en-PK') : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {user.id !== session.user.id && (
                        <UserRoleActions
                          tenantUserId={tenantUser.id}
                          currentRole={tenantUser.role}
                          isActive={tenantUser.isActive ?? true}
                          roles={ROLES}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Roles reference card */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Role Permissions Reference
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <div key={r.value} className="flex items-start gap-2.5">
                <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded text-xs font-medium ${roleColors[r.value] ?? 'bg-slate-100 text-slate-600'}`}>
                  {r.label}
                </span>
                <p className="text-xs text-slate-500">{r.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
