import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { suppliers, shipments, purchaseOrders, grns, letterOfCredits, chartOfAccounts } from '@/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BillForm } from '@/components/finance/bill-form';

export default async function NewBillPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const [allSuppliers, allShipments, allPos, allGrns, allLcs, allAccounts] = await Promise.all([
    tdb.select({ id: suppliers.id, code: suppliers.code, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
    tdb.select({ id: shipments.id, shipmentNo: shipments.shipmentNo }).from(shipments),
    tdb.select({ id: purchaseOrders.id, poNo: purchaseOrders.poNo }).from(purchaseOrders).where(inArray(purchaseOrders.status, ['confirmed', 'lc_requested', 'lc_opened', 'goods_dispatched', 'fully_received', 'invoiced'])),
    tdb.select({ id: grns.id, grnNo: grns.grnNo }).from(grns).where(inArray(grns.status, ['posted', 'qc_released'])),
    tdb.select({ id: letterOfCredits.id, lcNo: letterOfCredits.lcNo }).from(letterOfCredits),
    tdb.select({ code: chartOfAccounts.code, name: chartOfAccounts.name, accountType: chartOfAccounts.accountType })
      .from(chartOfAccounts).where(eq(chartOfAccounts.isGroup, false)).orderBy(asc(chartOfAccounts.sortOrder)),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance/bills">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Vendor Bill</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record payable to supplier or service provider</p>
        </div>
      </div>
      <BillForm
        suppliers={allSuppliers as any}
        shipments={allShipments}
        pos={allPos}
        grns={allGrns}
        lcs={allLcs}
        accounts={allAccounts}
      />
    </div>
  );
}
