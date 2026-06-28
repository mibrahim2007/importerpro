import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { InquiryForm } from '@/components/sales/inquiry-form';

export default async function NewInquiryPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [cList, pList] = await Promise.all([
    tdb.select({ id: customers.id, name: customers.name, code: customers.code })
      .from(customers).where(eq(customers.isActive, true)),
    tdb.select({ id: products.id, name: products.name, code: products.code, uom: products.uom })
      .from(products).where(eq(products.isActive, true)),
  ]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/sales/inquiries"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-slate-900">New Sales Inquiry</h1>
      </div>
      <InquiryForm customers={cList} products={pList} />
    </div>
  );
}
