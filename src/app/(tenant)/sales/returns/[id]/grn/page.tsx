import { auth } from '@/lib/auth/config';
import { redirect, notFound } from 'next/navigation';
import { getTenantDb } from '@/db';
import {
  returnAuthorizations, returnAuthorizationLines, warehouses, products, customers,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ReturnGrnForm } from '@/components/sales/return-grn-form';

export const revalidate = 0;

export default async function ReturnGrnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raId } = await params;
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[ra], raLines, warehouseList] = await Promise.all([
    tdb.select({
      id: returnAuthorizations.id,
      raNo: returnAuthorizations.raNo,
      status: returnAuthorizations.status,
      customerId: returnAuthorizations.customerId,
      customerName: customers.name,
    })
    .from(returnAuthorizations)
    .leftJoin(customers, eq(customers.id, returnAuthorizations.customerId))
    .where(eq(returnAuthorizations.id, raId)),

    tdb.select({
      id: returnAuthorizationLines.id,
      productId: returnAuthorizationLines.productId,
      description: returnAuthorizationLines.description,
      returnQty: returnAuthorizationLines.returnQty,
      uom: returnAuthorizationLines.uom,
      lotNo: returnAuthorizationLines.lotNo,
      productName: products.name,
    })
    .from(returnAuthorizationLines)
    .leftJoin(products, eq(products.id, returnAuthorizationLines.productId))
    .where(eq(returnAuthorizationLines.raId, raId))
    .orderBy(returnAuthorizationLines.sortOrder),

    tdb.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
  ]);

  if (!ra) notFound();
  if (ra.status !== 'approved') redirect(`/sales/returns/${raId}`);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Return GRN</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          For <strong>{ra.raNo}</strong> · Customer: <strong>{ra.customerName}</strong>
        </p>
      </div>
      <ReturnGrnForm raId={raId} raNo={ra.raNo ?? ''} raLines={raLines} warehouses={warehouseList} />
    </div>
  );
}
