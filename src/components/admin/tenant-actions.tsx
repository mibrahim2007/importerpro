'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, LogIn, PauseCircle, PlayCircle } from 'lucide-react';

interface TenantActionsProps {
  tenantId: string;
  status: string;
  slug: string;
}

export function TenantActions({ tenantId, status, slug }: TenantActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: 'active' | 'suspended', reason?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Tenant ${newStatus === 'active' ? 'reactivated' : 'suspended'}`);
      router.refresh();
    } catch {
      toast.error('Failed to update tenant status');
    } finally {
      setLoading(false);
    }
  };

  const impersonate = async () => {
    toast.info(`Impersonation for "${slug}" — coming soon`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors outline-none"
        disabled={loading}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => router.push(`/admin/tenants/${tenantId}`)}>
          <Eye className="mr-2 h-4 w-4" />
          View Detail
        </DropdownMenuItem>
        <DropdownMenuItem onClick={impersonate}>
          <LogIn className="mr-2 h-4 w-4" />
          Impersonate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {status === 'active' ? (
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => {
              const reason = window.prompt('Reason for suspension:');
              if (reason !== null) updateStatus('suspended', reason);
            }}
          >
            <PauseCircle className="mr-2 h-4 w-4" />
            Suspend
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-green-600"
            onClick={() => updateStatus('active')}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Reactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
