'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PauseCircle, PlayCircle, Loader2 } from 'lucide-react';

export function TenantStatusButton({
  tenantId,
  currentStatus,
}: {
  tenantId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    let reason: string | null = null;

    if (newStatus === 'suspended') {
      reason = window.prompt('Reason for suspension:');
      if (reason === null) return;
    }

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
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className={currentStatus === 'active' ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : currentStatus === 'active' ? (
        <><PauseCircle className="h-4 w-4 mr-1.5" /> Suspend</>
      ) : (
        <><PlayCircle className="h-4 w-4 mr-1.5" /> Reactivate</>
      )}
    </Button>
  );
}
