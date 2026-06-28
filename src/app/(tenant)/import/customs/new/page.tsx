import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { shipments } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { GdForm } from '@/components/customs/gd-form';

export default async function NewGdPage({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { shipment: initialShipmentId } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const arrivedShipments = await tdb
    .select({ id: shipments.id, shipmentNo: shipments.shipmentNo, blNo: shipments.blNo, portOfDischarge: shipments.portOfDischarge })
    .from(shipments)
    .where(inArray(shipments.status, ['arrived', 'do_released', 'customs_cleared']));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/customs">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Goods Declaration</h1>
          <p className="text-sm text-slate-500 mt-0.5">File a WeBOC GD and calculate duty payable</p>
        </div>
      </div>
      <GdForm shipments={arrivedShipments} initialShipmentId={initialShipmentId} />
    </div>
  );
}
