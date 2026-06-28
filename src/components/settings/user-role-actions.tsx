'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Shield, UserX, UserCheck, Loader2 } from 'lucide-react';

interface Role { value: string; label: string }

export function UserRoleActions({
  tenantUserId,
  currentRole,
  isActive,
  roles,
}: {
  tenantUserId: string;
  currentRole: string;
  isActive: boolean;
  roles: Role[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const update = async (body: object) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/users/${tenantUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error('Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <p className="px-2 py-1.5 text-xs font-medium text-slate-400">Change Role</p>
        {roles.filter((r) => r.value !== currentRole).map((r) => (
          <DropdownMenuItem
            key={r.value}
            className="text-sm"
            onClick={() => update({ role: r.value })}
          >
            <Shield className="h-3.5 w-3.5 mr-2 text-slate-400" />
            Set as {r.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={`text-sm ${isActive ? 'text-red-600' : 'text-green-600'}`}
          onClick={() => update({ isActive: !isActive })}
        >
          {isActive
            ? <><UserX className="h-3.5 w-3.5 mr-2" /> Deactivate</>
            : <><UserCheck className="h-3.5 w-3.5 mr-2" /> Reactivate</>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
