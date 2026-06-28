import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { landedCosts, shipments, goodsDeclarations, letterOfCredits, grns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CostSheetEditor } from '@/components/cost-sheet/cost-sheet-editor';

export const revalidate = 0;

export default async function CostSheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [sheet] = await tdb.select().from(landedCosts).where(eq(landedCosts.id, id)).limit(1);
  if (!sheet) notFound();

  const [[shipment], [gd], [lc], [grn]] = await Promise.all([
    tdb.select({ shipmentNo: shipments.shipmentNo }).from(shipments).where(eq(shipments.id, sheet.shipmentId)).limit(1),
    sheet.gdId ? tdb.select({ gdNo: goodsDeclarations.gdNo }).from(goodsDeclarations).where(eq(goodsDeclarations.id, sheet.gdId)).limit(1) : Promise.resolve([null]),
    sheet.lcId ? tdb.select({ lcNo: letterOfCredits.lcNo }).from(letterOfCredits).where(eq(letterOfCredits.id, sheet.lcId)).limit(1) : Promise.resolve([null]),
    sheet.grnId ? tdb.select({ grnNo: grns.grnNo }).from(grns).where(eq(grns.id, sheet.grnId)).limit(1) : Promise.resolve([null]),
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/import/cost-sheet">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-mono font-bold text-slate-900">{sheet.costSheetNo}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sheet.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {sheet.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            {shipment && <Link href={`/import/shipments/${sheet.shipmentId}`} className="font-mono text-indigo-600 hover:underline">{shipment.shipmentNo}</Link>}
            {gd && <Link href={`/import/customs/${sheet.gdId}`} className="font-mono text-slate-600 hover:underline">{(gd as any).gdNo ?? 'GD'}</Link>}
            {lc && <Link href={`/import/lc/${sheet.lcId}`} className="font-mono text-blue-600 hover:underline">{(lc as any).lcNo}</Link>}
            {grn && <Link href={`/import/grn/${sheet.grnId}`} className="font-mono text-teal-600 hover:underline">{(grn as any).grnNo}</Link>}
          </div>
        </div>
      </div>

      <CostSheetEditor sheet={sheet as any} />
    </div>
  );
}
