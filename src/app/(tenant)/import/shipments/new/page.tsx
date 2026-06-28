import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { purchaseOrders, letterOfCredits } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ShipmentForm } from '@/components/shipments/shipment-form';

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ po?: string; lc?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { po: initialPoId, lc: initialLcId } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [openPos, openLcs] = await Promise.all([
    tdb.select({ id: purchaseOrders.id, poNo: purchaseOrders.poNo, supplierId: purchaseOrders.supplierId })
      .from(purchaseOrders)
      .where(inArray(purchaseOrders.status, ['confirmed', 'lc_requested', 'lc_opened', 'goods_dispatched'])),
    tdb.select({ id: letterOfCredits.id, lcNo: letterOfCredits.lcNo, poId: letterOfCredits.poId })
      .from(letterOfCredits)
      .where(inArray(letterOfCredits.status, ['opened', 'documents_presented', 'under_scrutiny', 'accepted'])),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/shipments">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Shipment</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record shipment dispatch details and B/L information</p>
        </div>
      </div>
      <ShipmentForm
        openPos={openPos}
        openLcs={openLcs}
        suppliers={[]}
        initialPoId={initialPoId}
        initialLcId={initialLcId}
      />
    </div>
  );
}
