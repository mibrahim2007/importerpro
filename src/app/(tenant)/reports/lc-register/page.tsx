import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { letterOfCredits, suppliers, lcCharges } from '@/db/schema';
import { eq, ne, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LcRegisterClient } from '@/components/reports/lc-register-client';

export const revalidate = 0;

export default async function LcRegisterPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);

  const rows = await tdb
    .select({
      lcId: letterOfCredits.id,
      lcNo: letterOfCredits.lcNo,
      lcType: letterOfCredits.lcType,
      lcAmount: letterOfCredits.lcAmount,
      currency: letterOfCredits.currency,
      issuingBank: letterOfCredits.issuingBank,
      openingDate: letterOfCredits.openingDate,
      expiryDate: letterOfCredits.expiryDate,
      latestShipDate: letterOfCredits.latestShipDate,
      status: letterOfCredits.status,
      supplierName: suppliers.name,
      supplierCountry: suppliers.country,
      totalCharges: sql<string>`COALESCE(SUM(${lcCharges.amount}), 0)`,
    })
    .from(letterOfCredits)
    .leftJoin(suppliers, eq(suppliers.id, letterOfCredits.supplierId))
    .leftJoin(lcCharges, eq(lcCharges.lcId, letterOfCredits.id))
    .where(ne(letterOfCredits.status, 'cancelled'))
    .groupBy(letterOfCredits.id, suppliers.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">LC Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">All letters of credit with beneficiary, expiry, and bank charges</p>
        </div>
      </div>
      <LcRegisterClient rows={rows} />
    </div>
  );
}
