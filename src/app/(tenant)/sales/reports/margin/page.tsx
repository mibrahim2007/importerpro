import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { MarginReportClient } from '@/components/sales/reports/margin-report-client';

export const revalidate = 0;

export default async function MarginReportPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');
  return <MarginReportClient />;
}
