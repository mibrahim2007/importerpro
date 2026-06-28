import { auth } from '@/lib/auth/config';
import { db, getTenantDb } from '@/db';
import { products, hsCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { ProductForm } from '@/components/master/product-form';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[product], hsCodeList] = await Promise.all([
    tdb.select().from(products).where(eq(products.id, id)).limit(1),
    db.select({ code: hsCodes.hsCode, description: hsCodes.description }).from(hsCodes).where(eq(hsCodes.isActive, true)).limit(500),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit Product</h1>
        <p className="text-sm text-slate-500 mt-0.5 font-mono">{product.code ?? product.name}</p>
      </div>
      <ProductForm hsCodes={hsCodeList} product={product} />
    </div>
  );
}
