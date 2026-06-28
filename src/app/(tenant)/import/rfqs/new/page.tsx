import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { RfqForm } from '@/components/rfq/rfq-form';

export default async function NewRfqPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const allSuppliers = await tdb.select({
    id: suppliers.id,
    name: suppliers.name,
    code: suppliers.code,
    supplierType: suppliers.supplierType,
  }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/import/rfqs">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New RFQ</h1>
          <p className="text-sm text-slate-500 mt-0.5">Request for Quotation</p>
        </div>
      </div>
      <RfqForm suppliers={allSuppliers} />
    </div>
  );
}
