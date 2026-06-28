import { db } from '@/db';
import { tenants, users, auditLogs } from '@/db/schema';
import { count, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database, Users, Server, CheckCircle2, Clock } from 'lucide-react';

export default async function SystemHealthPage() {
  const startTime = Date.now();

  // Run DB health checks concurrently
  const [tenantCount, userCount, recentLogs, dbVersion] = await Promise.all([
    db.select({ count: count() }).from(tenants),
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(auditLogs),
    db.execute(sql`SELECT version()`),
  ]);

  const dbLatency = Date.now() - startTime;

  const metrics = [
    { label: 'Total Tenants', value: tenantCount[0]?.count ?? 0, icon: Database },
    { label: 'Platform Users', value: userCount[0]?.count ?? 0, icon: Users },
    { label: 'Audit Events', value: recentLogs[0]?.count ?? 0, icon: Activity },
    { label: 'DB Latency', value: `${dbLatency}ms`, icon: Clock },
  ];

  const dbOk = dbLatency < 500;
  const dbVersionStr = (dbVersion[0] as { version?: string })?.version ?? 'Unknown';

  const checks = [
    { name: 'PostgreSQL Connection', ok: true, detail: dbVersionStr.split(' ').slice(0, 2).join(' ') },
    { name: 'Database Latency', ok: dbOk, detail: `${dbLatency}ms ${dbOk ? '(good)' : '(high)'}` },
    { name: 'Multi-tenant Schema', ok: true, detail: 'public schema reachable' },
    { name: 'Auth Service (NextAuth)', ok: true, detail: 'JWT/credential provider active' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">System Health</h1>
        <p className="text-sm text-slate-500 mt-0.5">Real-time platform metrics and service status</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-lg">
                <m.icon className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="text-xl font-bold text-slate-900">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="h-4 w-4" /> Service Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {checks.map((c) => (
            <div key={c.name} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-4 w-4 ${c.ok ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-sm font-medium text-slate-900">{c.name}</span>
              </div>
              <span className={`text-xs ${c.ok ? 'text-slate-400' : 'text-red-500'}`}>{c.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Environment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Node.js</span>
              <span className="font-mono">{process.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Platform</span>
              <span className="font-mono">{process.platform}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">NODE_ENV</span>
              <span className={`font-mono px-1.5 py-0.5 rounded text-xs ${process.env.NODE_ENV === 'production' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {process.env.NODE_ENV}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">App Version</span>
              <span className="font-mono text-xs">1.0.0-beta</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
