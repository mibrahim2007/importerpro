import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { branches } from '@/db/schema';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { BranchActions } from '@/components/settings/branch-actions';
import { MapPin, Phone } from 'lucide-react';

export default async function BranchesPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const allBranches = await tdb.select().from(branches);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Branches</h1>
          <p className="text-sm text-slate-500 mt-0.5">Office and factory locations for your organization</p>
        </div>
        <BranchActions mode="create" />
      </div>

      <div className="space-y-3">
        {allBranches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-400">
              No branches yet. Add your first branch to get started.
            </CardContent>
          </Card>
        ) : (
          allBranches.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{b.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {b.address && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.address}{b.city ? `, ${b.city}` : ''}
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Phone className="h-3.5 w-3.5" />
                      {b.phone}
                    </div>
                  )}
                </div>
                <BranchActions mode="edit" branch={b} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
