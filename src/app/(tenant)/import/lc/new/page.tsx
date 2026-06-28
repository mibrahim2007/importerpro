import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { suppliers, purchaseOrders } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LcForm } from '@/components/lc/lc-form';

export default async function NewLcPage({ searchParams }: { searchParams: Promise<{ po?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { po: initialPoId } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allSuppliers, openPos] = await Promise.all([
    tdb.select({ id: suppliers.id, name: suppliers.name, code: suppliers.code })
      .from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    tdb.select({
      id: purchaseOrders.id,
      poNo: purchaseOrders.poNo,
      supplierId: purchaseOrders.supplierId,
      cifValueUsd: purchaseOrders.cifValueUsd,
      currency: purchaseOrders.currency,
      portOfDischarge: purchaseOrders.portOfDischarge,
      portOfLoading: purchaseOrders.portOfLoading,
      incoterms: purchaseOrders.incoterms,
      latestShipDate: purchaseOrders.latestShipDate,
      lcExpiryDate: purchaseOrders.lcExpiryDate,
      bankIssuingLc: purchaseOrders.bankIssuingLc,
    }).from(purchaseOrders)
      .where(inArray(purchaseOrders.status, ['confirmed', 'lc_requested']))
      .orderBy(purchaseOrders.poNo),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/lc">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Open Letter of Credit</h1>
          <p className="text-sm text-slate-500 mt-0.5">Apply to issuing bank to open a new LC</p>
        </div>
      </div>
      <LcForm suppliers={allSuppliers} openPos={openPos} initialPoId={initialPoId} />
    </div>
  );
}
