'use client';

import Link from 'next/link';
import { ChevronDown, Settings, LogOut, User } from 'lucide-react';
import { signOut } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface NavbarProps {
  userName?: string;
  userEmail?: string;
  notificationCount?: number;
}

export function Navbar({ userName, userEmail, notificationCount = 0 }: NavbarProps) {
  const router = useRouter();
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-teal-600 rounded flex items-center justify-center text-white font-bold text-sm">
          IP
        </div>
        <span className="text-white font-semibold text-sm hidden sm:block">ImporterPro</span>
      </Link>

      {/* Main nav */}
      <nav className="hidden md:flex items-center gap-1 ml-4">
        {[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/import/indents', label: 'Import' },
          { href: '/warehouse/stock', label: 'Stock' },
          { href: '/sales/orders', label: 'Sales' },
          { href: '/finance/bills', label: 'Finance' },
          { href: '/reports', label: 'Reports' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Notification Bell */}
        <NotificationBell initialUnread={notificationCount} />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors outline-none"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-teal-600 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm hidden sm:block">{userName}</span>
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
