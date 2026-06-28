import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { warehouses, branches, stockLocations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WarehouseActions } from '@/components/settings/warehouse-actions';
import { Warehouse, MapPin, Layers } from 'lucide-react';

export default async function WarehousesPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [allWarehouses, allBranches, allLocations] = await Promise.all([
    tdb.select().from(warehouses),
    tdb.select().from(branches).where(eq(branches.isActive, true)),
    tdb.select().from(stockLocations),
  ]);

  const branchMap = Object.fromEntries(allBranches.map((b) => [b.id, b.name]));
  const locationsByWarehouse = allLocations.reduce<Record<string, typeof allLocations>>((acc, loc) => {
    acc[loc.warehouseId] = acc[loc.warehouseId] ?? [];
    acc[loc.warehouseId].push(loc);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Warehouses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Storage facilities and bin/rack locations</p>
        </div>
        <WarehouseActions mode="create" branches={allBranches} />
      </div>

      <div className="space-y-4">
        {allWarehouses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-400">
              No warehouses yet. Add your first warehouse to enable stock management.
            </CardContent>
          </Card>
        ) : (
          allWarehouses.map((wh) => {
            const locations = locationsByWarehouse[wh.id] ?? [];
            return (
              <Card key={wh.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-teal-600" />
                        <CardTitle className="text-base">{wh.name}</CardTitle>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${wh.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {wh.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        {branchMap[wh.branchId] && <span>Branch: {branchMap[wh.branchId]}</span>}
                        {wh.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />{wh.city}
                          </span>
                        )}
                      </div>
                    </div>
                    <WarehouseActions mode="edit" warehouse={wh} branches={allBranches} />
                  </div>
                </CardHeader>

                {/* Stock Locations */}
                <CardContent className="pt-0 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Stock Locations ({locations.length})
                    </p>
                    <WarehouseActions mode="add-location" warehouseId={wh.id} branches={allBranches} />
                  </div>
                  {locations.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No locations — add bins/racks to enable precise stock tracking</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {locations.map((loc) => (
                        <span key={loc.id} className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                          {loc.name}
                          <span className="ml-1.5 text-slate-400 text-xs">{loc.locationType}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
