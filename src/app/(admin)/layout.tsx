import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminNavbar } from '@/components/admin/admin-navbar';
import { Toaster } from '@/components/ui/sonner';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  if (!session.user.isSuperAdmin) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavbar userName={session.user.name ?? session.user.email ?? 'Admin'} />
      <AdminSidebar />
      <main className="ml-56 mt-14 p-6 min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
