import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments, goodsDeclarations, letterOfCredits, grns } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CostSheetNewForm } from '@/components/cost-sheet/cost-sheet-new-form';

export default async function NewCostSheetPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [readyShipments, clearedGds, activeLcs, postedGrns] = await Promise.all([
    tdb.select({ id: shipments.id, shipmentNo: shipments.shipmentNo, poId: shipments.poId, lcId: shipments.lcId })
      .from(shipments)
      .where(inArray(shipments.status, ['customs_cleared', 'grn_done'])),
    tdb.select({ id: goodsDeclarations.id, gdNo: goodsDeclarations.gdNo, shipmentId: goodsDeclarations.shipmentId })
      .from(goodsDeclarations)
      .where(inArray(goodsDeclarations.status, ['duty_paid', 'cleared'])),
    tdb.select({ id: letterOfCredits.id, lcNo: letterOfCredits.lcNo })
      .from(letterOfCredits)
      .where(inArray(letterOfCredits.status, ['opened', 'documents_presented', 'under_scrutiny', 'accepted', 'retired'])),
    tdb.select({ id: grns.id, grnNo: grns.grnNo, shipmentId: grns.shipmentId })
      .from(grns)
      .where(inArray(grns.status, ['posted', 'qc_released'])),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/cost-sheet">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Landed Cost Sheet</h1>
          <p className="text-sm text-slate-500 mt-0.5">Aggregate all import costs to compute per-unit landed cost</p>
        </div>
      </div>
      <CostSheetNewForm
        shipments={readyShipments}
        gds={clearedGds as any}
        lcs={activeLcs}
        grns={postedGrns as any}
      />
    </div>
  );
}
