import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { TaxRegisterClient } from '@/components/sales/reports/tax-register-client';

export const revalidate = 0;

export default async function TaxRegisterPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  return <TaxRegisterClient />;
}
