'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Tag,
  Anchor,
  Ship,
  DollarSign,
  Globe,
  Activity,
  ScrollText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText },
    ],
  },
  {
    title: 'TENANT MANAGEMENT',
    items: [
      { label: 'All Tenants', href: '/admin/tenants', icon: Building2 },
      { label: 'Plans & Billing', href: '/admin/plans', icon: CreditCard },
    ],
  },
  {
    title: 'PLATFORM CONFIG',
    items: [
      { label: 'HS Codes', href: '/admin/config/hs-codes', icon: Tag },
      { label: 'Ports', href: '/admin/config/ports', icon: Anchor },
      { label: 'Shipping Lines', href: '/admin/config/shipping-lines', icon: Ship },
      { label: 'Currencies', href: '/admin/config/currencies', icon: DollarSign },
      { label: 'Countries', href: '/admin/config/countries', icon: Globe },
    ],
  },
  {
    title: 'MONITORING',
    items: [
      { label: 'System Health', href: '/admin/monitor', icon: Activity },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-56 bg-slate-900 border-r border-slate-700 overflow-y-auto z-40 flex flex-col">
      <nav className="flex-1 py-3 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            <button
              className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400"
              onClick={() => toggleGroup(group.title)}
            >
              {group.title}
              {collapsed[group.title]
                ? <ChevronRight className="h-3 w-3" />
                : <ChevronDown className="h-3 w-3" />}
            </button>
            {!collapsed[group.title] && (
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                      isActive(item.href, item.exact)
                        ? 'bg-violet-700/30 text-violet-300 font-medium'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
