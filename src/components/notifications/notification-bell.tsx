'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, RefreshCw, AlertTriangle, Info, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  info:     'bg-blue-400',
};

const PRIORITY_ICON: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  high:     AlertCircle,
  medium:   Clock,
  info:     Info,
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props { initialUnread: number }

export function NotificationBell({ initialUnread }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=10');
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } finally { setLoading(false); }
  };

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) fetchNotifications();
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/notifications/scan', { method: 'POST' });
      const data = await res.json();
      if (data.created > 0) {
        toast.success(`${data.created} new alert${data.created > 1 ? 's' : ''} generated`);
        fetchNotifications();
        router.refresh();
      } else {
        toast.success('All clear — no new alerts');
      }
    } finally { setScanning(false); }
  };

  const refHref = (n: Notification) => {
    const map: Record<string, string> = {
      shipment: '/import/shipments',
      lc: '/import/lc',
      purchase_order: '/import/purchase-orders',
      goods_declaration: '/import/customs',
      indent: '/import/indents',
      vendor_bill: '/finance/bills',
      grn: '/import/grn',
    };
    return n.referenceType ? `${map[n.referenceType] ?? '#'}` : '#';
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
            <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={runScan}
                disabled={scanning}
                title="Check for new alerts"
                className="p-1.5 text-slate-400 hover:text-teal-600 rounded transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
              </button>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-teal-600 hover:bg-teal-50 rounded transition-colors"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">Loading...</div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No notifications</div>
            ) : (
              items.map((n) => {
                const Icon = PRIORITY_ICON[n.priority ?? 'info'] ?? Info;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${PRIORITY_COLORS[n.priority ?? 'info']}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">{n.createdAt ? timeAgo(n.createdAt) : ''}</span>
                        {n.referenceNo && (
                          <Link href={refHref(n)} onClick={() => { markRead(n.id); setOpen(false); }}
                            className="text-xs text-teal-600 hover:underline">{n.referenceNo}</Link>
                        )}
                      </div>
                    </div>
                    {!n.isRead && (
                      <button onClick={() => markRead(n.id)} className="shrink-0 p-1 text-slate-300 hover:text-teal-600 rounded transition-colors">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t bg-slate-50 text-center">
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-teal-600 hover:underline font-medium">
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
