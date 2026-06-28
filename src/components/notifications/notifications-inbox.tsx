'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, CheckCheck, RefreshCw, AlertTriangle, AlertCircle, Clock, Info } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  priority: string | null;
  referenceType: string | null;
  referenceNo: string | null;
  isRead: boolean | null;
  createdAt: string | null;
}

const PRIORITY_LEFT: Record<string, string> = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-500',
  medium:   'border-l-amber-400',
  info:     'border-l-blue-400',
};

const PRIORITY_ICON: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  high:     AlertCircle,
  medium:   Clock,
  info:     Info,
};

const PRIORITY_ICON_COLOR: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-orange-500',
  medium:   'text-amber-500',
  info:     'text-blue-400',
};

const REF_HREFS: Record<string, string> = {
  shipment: '/import/shipments',
  lc: '/import/lc',
  purchase_order: '/import/purchase-orders',
  goods_declaration: '/import/customs',
  indent: '/import/indents',
  vendor_bill: '/finance/bills',
  grn: '/import/grn',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Props {
  items: Notification[];
  filter: string;
  unreadCount: number;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'critical', label: 'Critical' },
];

export function NotificationsInbox({ items: initialItems, filter, unreadCount: initialUnread }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [scanning, setScanning] = useState(false);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnread((u) => Math.max(0, u - 1));
    router.refresh();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    router.refresh();
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/notifications/scan', { method: 'POST' });
      const data = await res.json();
      if (data.created > 0) {
        toast.success(`${data.created} new alert${data.created > 1 ? 's' : ''} generated`);
        router.refresh();
      } else {
        toast.success('All clear — no new alerts at this time');
      }
    } finally { setScanning(false); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/notifications?filter=${f.key}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f.label}
              {f.key === 'unread' && unread > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">{unread}</span>
              )}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={runScan} disabled={scanning}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            Check Alerts
          </Button>
          {unread > 0 && (
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-400">
            <Info className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No notifications{filter !== 'all' ? ` in "${filter}" filter` : ''}.</p>
            <p className="text-xs mt-1">Use "Check Alerts" to scan for new alerts.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const p = n.priority ?? 'info';
            const Icon = PRIORITY_ICON[p] ?? Info;
            return (
              <Card key={n.id} className={`border-l-4 ${PRIORITY_LEFT[p] ?? 'border-l-slate-200'} ${!n.isRead ? 'bg-blue-50/30' : ''}`}>
                <CardContent className="p-4 flex gap-4">
                  <div className="shrink-0 mt-0.5">
                    <Icon className={`h-5 w-5 ${PRIORITY_ICON_COLOR[p]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{n.title}</p>
                    {n.body && <p className="text-sm text-slate-500 mt-1 leading-snug">{n.body}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400">{n.createdAt ? timeAgo(n.createdAt) : ''}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        p === 'critical' ? 'bg-red-100 text-red-700' :
                        p === 'high'     ? 'bg-orange-100 text-orange-700' :
                        p === 'medium'   ? 'bg-amber-100 text-amber-700' :
                                           'bg-blue-100 text-blue-700'
                      }`}>{p}</span>
                      {n.referenceNo && n.referenceType && (
                        <Link href={REF_HREFS[n.referenceType] ?? '#'}
                          className="text-xs text-teal-600 hover:underline font-medium">
                          View {n.referenceNo}
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.isRead && (
                    <button onClick={() => markRead(n.id)} className="shrink-0 p-1.5 text-slate-300 hover:text-teal-600 rounded-lg transition-colors" title="Mark as read">
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
