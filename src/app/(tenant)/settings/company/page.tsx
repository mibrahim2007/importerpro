import { auth } from '@/lib/auth/config';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { CompanyProfileForm } from '@/components/settings/company-profile-form';

export default async function CompanyProfilePage() {
  const session = await auth();
  if (!session?.user.tenantId) redirect('/login');

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, session.user.tenantId)).limit(1);
  if (!tenant) redirect('/login');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Company Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Business registration details used on all official documents</p>
      </div>
      <CompanyProfileForm tenant={tenant} />
    </div>
  );
}
