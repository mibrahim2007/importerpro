import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { indents, indentLines, products, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { RfqForm } from '@/components/rfq/rfq-form';

export default async function NewRfqFromIndentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [indent] = await tdb.select().from(indents).where(eq(indents.id, id)).limit(1);
  if (!indent || indent.status !== 'approved') notFound();

  const [lines, allSuppliers] = await Promise.all([
    tdb.select({ line: indentLines, product: products })
      .from(indentLines)
      .leftJoin(products, eq(indentLines.productId, products.id))
      .where(eq(indentLines.indentId, id))
      .orderBy(indentLines.sortOrder),
    tdb.select({
      id: suppliers.id,
      name: suppliers.name,
      code: suppliers.code,
      supplierType: suppliers.supplierType,
    }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name),
  ]);

  const formLines = lines.map(({ line, product }) => ({
    ...line,
    product: product
      ? { id: product.id, name: product.name, code: product.code, uom: product.uom, hsCode: product.hsCode }
      : null,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/import/indents/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Create RFQ</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-mono">from {indent.indentNo}</p>
        </div>
      </div>

      <RfqForm
        indentId={indent.id}
        indentNo={indent.indentNo}
        indentLines={formLines}
        suppliers={allSuppliers}
      />
    </div>
  );
}
