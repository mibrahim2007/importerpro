import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customerAddresses } from '@/db/schema';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { DcForm } from '@/components/sales/dc-form';

export default async function NewDispatchPage({
  searchParams,
}: { searchParams: Promise<{ soId?: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  const { soId } = await searchParams;

  // Fetch confirmed SOs with reserved lines via the API (server-side direct call not needed — DcForm fetches client-side)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/sales/dispatch"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-slate-900">New Dispatch Challan</h1>
      </div>
      <DcForm prefillSoId={soId} />
    </div>
  );
}
