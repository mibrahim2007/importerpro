import { db } from '@/db';
import { hsCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ProductForm } from '@/components/master/product-form';

export default async function NewProductPage() {
  const hsCodeList = await db.select({
    code: hsCodes.hsCode,
    description: hsCodes.description,
  }).from(hsCodes).where(eq(hsCodes.isActive, true)).limit(500);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Product</h1>
        <p className="text-sm text-slate-500 mt-0.5">Add a raw material, packing item, or finished good to the master list</p>
      </div>
      <ProductForm hsCodes={hsCodeList} />
    </div>
  );
}
