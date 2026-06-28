'use client';

import Link from 'next/link';
import { Shield, ChevronDown, LogOut, ExternalLink } from 'lucide-react';
import { signOut } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export function AdminNavbar({ userName }: { userName: string }) {
  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4 gap-4">
      <Link href="/admin" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-violet-600 rounded flex items-center justify-center">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm">ImporterPro</span>
        <Badge className="bg-violet-700 text-violet-100 text-[10px] px-1.5 py-0">SUPER ADMIN</Badge>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Tenant View
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors outline-none">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-violet-600 text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm hidden sm:block">{userName}</span>
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
