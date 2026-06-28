'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  PackageOpen,
  FileText,
  Ship,
  ClipboardList,
  Warehouse,
  ArrowLeftRight,
  BarChart3,
  BarChart2,
  Users,
  ShoppingCart,
  Truck,
  Receipt,
  CreditCard,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Settings,
  Calculator as CalculatorIcon,
  BookOpen,
  Bell,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'IMPORT OPERATIONS',
    items: [
      { label: 'Indents', href: '/import/indents', icon: ClipboardList },
      { label: 'RFQs', href: '/import/rfqs', icon: FileText },
      { label: 'Purchase Orders', href: '/import/purchase-orders', icon: FileText },
      { label: 'LC Management', href: '/import/lc', icon: CreditCard },
      { label: 'Shipments', href: '/import/shipments', icon: Ship },
      { label: 'Customs / GD', href: '/import/customs', icon: PackageOpen },
      { label: 'Proforma Invoices', href: '/import/proforma', icon: FileText },
      { label: 'Commercial Invoices', href: '/import/commercial', icon: FileText },
      { label: 'Goods Receipt (GRN)', href: '/import/grn', icon: PackageOpen },
      { label: 'Purchase Returns', href: '/import/returns', icon: ArrowLeftRight },
      { label: 'Debit Notes', href: '/import/debit-notes', icon: Receipt },
      { label: 'Landed Cost Sheet', href: '/import/cost-sheet', icon: CalculatorIcon },
    ],
  },
  {
    title: 'WAREHOUSE',
    items: [
      { label: 'Receipts (GRN)', href: '/import/grn', icon: Warehouse },
      { label: 'Stock on Hand', href: '/warehouse/stock', icon: BarChart3 },
      { label: 'Internal Transfers', href: '/warehouse/transfers', icon: ArrowLeftRight },
      { label: 'Adjustments', href: '/warehouse/adjustments', icon: BarChart3 },
    ],
  },
  {
    title: 'SALES',
    items: [
      { label: 'Customers', href: '/sales/customers', icon: Users },
      { label: 'Inquiries', href: '/sales/inquiries', icon: FileText },
      { label: 'Quotations', href: '/sales/quotations', icon: ClipboardList },
      { label: 'Sales Orders', href: '/sales/orders', icon: ShoppingCart },
      { label: 'Dispatch / Delivery', href: '/sales/dispatch', icon: Truck },
      { label: 'Sales Invoices', href: '/sales/invoices', icon: Receipt },
      { label: 'Customer Payments', href: '/sales/payments', icon: CreditCard },
      { label: 'Customer Returns', href: '/sales/returns', icon: ArrowLeftRight },
      { label: 'Credit Notes', href: '/sales/credit-notes', icon: Receipt },
      { label: 'Reports & Analytics', href: '/sales/reports', icon: TrendingUp },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Vendor Bills', href: '/finance/bills', icon: FileText },
      { label: 'Journal Entries', href: '/finance/journal', icon: BookOpen },
      { label: 'Exchange Rates', href: '/finance/exchange-rates', icon: TrendingUp },
      { label: 'Chart of Accounts', href: '/finance/accounts', icon: BarChart3 },
    ],
  },
  {
    title: 'MASTER DATA',
    items: [
      { label: 'Products', href: '/master/products', icon: PackageOpen },
      { label: 'Suppliers', href: '/master/suppliers', icon: Truck },
      { label: 'Customers', href: '/master/customers', icon: Users },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { label: 'Reports Hub', href: '/reports', icon: BarChart3 },
      { label: 'Consignment Tracker', href: '/reports/consignment-tracker', icon: Ship },
      { label: 'Duty Register', href: '/reports/duty-register', icon: FileText },
      { label: 'LC Register', href: '/reports/lc-register', icon: CreditCard },
      { label: 'Landed Cost', href: '/reports/landed-cost', icon: BarChart2 },
      { label: 'Stock Aging', href: '/reports/stock-aging', icon: PackageOpen },
      { label: 'Analytics', href: '/reports/analytics', icon: TrendingUp },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-60 bg-white border-r border-slate-200 overflow-y-auto z-40 flex flex-col">
      <nav className="flex-1 py-3 px-2 space-y-4">
        {/* Dashboard link */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname === '/dashboard'
              ? 'bg-teal-50 text-teal-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>

        {navGroups.map((group) => (
          <div key={group.title}>
            <button
              className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600"
              onClick={() => toggleGroup(group.title)}
            >
              {group.title}
              {collapsed[group.title] ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {!collapsed[group.title] && (
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href!}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                      pathname === item.href || pathname?.startsWith(item.href! + '/')
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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

      {/* Settings footer link */}
      <div className="border-t px-2 py-3">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
            pathname?.startsWith('/settings')
              ? 'bg-teal-50 text-teal-700 font-medium'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
