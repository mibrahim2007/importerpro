import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { products, warehouses, stockLocations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TransferForm } from '@/components/stock/transfer-form';

export default async function NewTransferPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allProducts, allWarehouses, allLocations] = await Promise.all([
    tdb.select({ id: products.id, code: products.code, name: products.name, uom: products.uom }).from(products).where(eq(products.isActive, true)).orderBy(products.name),
    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.isActive, true)),
    tdb.select({ id: stockLocations.id, warehouseId: stockLocations.warehouseId, name: stockLocations.name }).from(stockLocations).where(eq(stockLocations.isActive, true)),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/warehouse/transfers">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Internal Transfer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Move stock between warehouses or locations</p>
        </div>
      </div>
      <TransferForm products={allProducts as any} warehouses={allWarehouses} locations={allLocations} />
    </div>
  );
}
