import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { suppliers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PoForm } from '@/components/po/po-form';

export default async function NewPurchaseOrderPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const [allSuppliers, allProducts] = await Promise.all([
    tdb.select({ id: suppliers.id, name: suppliers.name, code: suppliers.code })
      .from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    tdb.select({ id: products.id, name: products.name, code: products.code, hsCode: products.hsCode, uom: products.uom })
      .from(products).where(eq(products.isActive, true)).orderBy(products.name),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/purchase-orders">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new import PO</p>
        </div>
      </div>
      <PoForm suppliers={allSuppliers} products={allProducts} />
    </div>
  );
}
