import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { SupplierForm } from '@/components/master/supplier-form';

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [supplier] = await tdb.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplier) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit Supplier</h1>
        <p className="text-sm text-slate-500 mt-0.5 font-mono">{supplier.code ?? supplier.name}</p>
      </div>
      <SupplierForm supplier={supplier} />
    </div>
  );
}
