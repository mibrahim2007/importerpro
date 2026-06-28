import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const actionColors: Record<string, string> = {
  SUSPEND_TENANT: 'bg-red-100 text-red-700',
  REACTIVATE_TENANT: 'bg-green-100 text-green-700',
  CREATE_TENANT: 'bg-blue-100 text-blue-700',
  UPDATE_PLAN: 'bg-amber-100 text-amber-700',
  LOGIN: 'bg-slate-100 text-slate-600',
  LOGOUT: 'bg-slate-100 text-slate-500',
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page = '1' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const limit = 50;
  const offset = (pageNum - 1) * limit;

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-0.5">All super admin actions — immutable record</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Timestamp</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Actor</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Action</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Resource</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Old → New</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No audit events yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-slate-900 truncate max-w-[140px]">{log.userEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <span className="capitalize">{log.resourceType}</span>
                      {log.resourceId && <span className="ml-1 font-mono text-slate-400">{log.resourceId.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.oldValue || log.newValue ? (
                        <span>
                          <span className="text-red-500">{log.oldValue ?? '—'}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="text-green-600">{log.newValue ?? '—'}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500 pb-4">
        <span>Showing page {pageNum} · {logs.length} records</span>
        <div className="flex gap-2">
          {pageNum > 1 && (
            <a href={`?page=${pageNum - 1}`} className="px-3 py-1.5 rounded border hover:bg-slate-50">← Prev</a>
          )}
          {logs.length === limit && (
            <a href={`?page=${pageNum + 1}`} className="px-3 py-1.5 rounded border hover:bg-slate-50">Next →</a>
          )}
        </div>
      </div>
    </div>
  );
}
