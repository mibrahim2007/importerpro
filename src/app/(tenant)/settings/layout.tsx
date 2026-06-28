import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, GitBranch, Warehouse, Users, BookOpen, Calculator, GitMerge, Bell } from 'lucide-react';

const navItems = [
  { href: '/settings/company', label: 'Company Profile', icon: Building2 },
  { href: '/settings/branches', label: 'Branches', icon: GitBranch },
  { href: '/settings/warehouses', label: 'Warehouses', icon: Warehouse },
  { href: '/settings/users', label: 'Users & Roles', icon: Users },
  { href: '/settings/coa', label: 'Chart of Accounts', icon: BookOpen },
  { href: '/settings/tax', label: 'Tax Configuration', icon: Calculator },
  { href: '/settings/approvals', label: 'Approval Workflows', icon: GitMerge },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  const canManage = ['tenant_admin', 'finance_manager'].includes(session.user.role ?? '');

  return (
    <div className="flex gap-6">
      {/* Left nav */}
      <aside className="w-52 shrink-0">
        <div className="sticky top-20">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Settings</p>
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors group"
              >
                <item.icon className="h-4 w-4 text-slate-400 group-hover:text-teal-600" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
