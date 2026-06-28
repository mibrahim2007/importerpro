import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CustomerForm } from '@/components/customers/customer-form';

export default async function NewCustomerPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/sales/customers"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">New Customer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Add a buyer to your customer master</p>
        </div>
      </div>
      <CustomerForm />
    </div>
  );
}
