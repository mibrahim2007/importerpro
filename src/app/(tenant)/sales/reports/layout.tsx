'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, FileText, Receipt, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPORTS = [
  { href: '/sales/reports/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/sales/reports/summary', label: 'Sales Summary', icon: FileText },
  { href: '/sales/reports/tax-register', label: 'FBR Tax Register', icon: Receipt },
  { href: '/sales/reports/margin', label: 'Gross Margin', icon: TrendingUp },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Sales Reports & Analytics</h1>
        <nav className="flex gap-1 mt-3">
          {REPORTS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition',
                pathname === href
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              )}>
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </nav>
        <div className="border-b mt-1" />
      </div>
      {children}
    </div>
  );
}
