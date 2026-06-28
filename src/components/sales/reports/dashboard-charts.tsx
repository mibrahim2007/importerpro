'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import Link from 'next/link';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

function pkr(v: number) {
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}cr`;
  if (v >= 100_000) return `${(v / 100_000).toFixed(1)}L`;
  return v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function KpiCard({ label, value, sub, color = 'text-slate-900', href }: {
  label: string; value: string | number; sub?: string; color?: string; href?: string
}) {
  const inner = (
    <div className="bg-white rounded-xl border p-4 hover:shadow-sm transition">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const AGING_COLORS = ['#0d9488', '#f59e0b', '#f97316', '#ef4444', '#991b1b'];

export function DashboardCharts({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        No data yet — start by creating some invoices.
      </div>
    );
  }

  const { pipeline, revenue, collections, monthlyRevenue, topCustomers, quotationFunnel, aging } = data;

  const totalAging = aging.current + aging.bucket0_30 + aging.bucket31_60 + aging.bucket61_90 + aging.bucket90plus;
  const agingChartData = [
    { name: 'Not Due', value: aging.current, fill: AGING_COLORS[0] },
    { name: '1–30d', value: aging.bucket0_30, fill: AGING_COLORS[1] },
    { name: '31–60d', value: aging.bucket31_60, fill: AGING_COLORS[2] },
    { name: '61–90d', value: aging.bucket61_90, fill: AGING_COLORS[3] },
    { name: '90+d', value: aging.bucket90plus, fill: AGING_COLORS[4] },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Row 1 — Pipeline */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Sales Pipeline</p>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Open Inquiries" value={pipeline.inquiries} sub="awaiting quotation" href="/sales/inquiries" />
          <KpiCard label="Active Quotations" value={pipeline.quotations} sub="draft + sent" href="/sales/quotations" />
          <KpiCard label="Confirmed Orders" value={pipeline.orders} sub="pending dispatch" color="text-teal-700" href="/sales/orders" />
          <KpiCard label="Unpaid Invoices" value={pipeline.invoiced} sub="balance outstanding" color={pipeline.invoiced > 0 ? 'text-amber-600' : 'text-slate-700'} href="/sales/invoices" />
        </div>
      </div>

      {/* Row 2 — Revenue */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Revenue (ex-tax)</p>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Revenue MTD" value={`PKR ${pkr(revenue.mtd)}`} color="text-teal-700" />
          <KpiCard label="Revenue YTD" value={`PKR ${pkr(revenue.ytd)}`} color="text-teal-700" />
          <KpiCard label="Collected MTD" value={`PKR ${pkr(collections.mtd)}`} color="text-green-700" sub="cleared receipts" />
          <KpiCard label="Overdue Balance" value={`PKR ${pkr(collections.overdueAmount)}`}
            color={collections.overdueAmount > 0 ? 'text-red-600' : 'text-green-600'}
            sub={collections.overdueCount > 0 ? `${collections.overdueCount} invoice${collections.overdueCount !== 1 ? 's' : ''}` : 'all current'}
            href="/sales/payments" />
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-3 gap-5">
        {/* Monthly Revenue — 2/3 width */}
        <div className="col-span-2 bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Monthly Revenue (ex-tax, PKR)</p>
          {monthlyRevenue.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs">No posted invoices yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => pkr(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(v: number) => [`PKR ${v.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, 'Revenue']} labelStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#0d9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quotation Win/Loss */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Quotation Win Rate (YTD)</p>
          <p className="text-3xl font-black text-teal-700 mb-3">{quotationFunnel.winRate}%</p>
          {quotationFunnel.pieData?.some((d: any) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={quotationFunnel.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                  {quotationFunnel.pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [v, name]} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-6 text-slate-400 text-xs">No quotations yet this year</p>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-5">
        {/* Top Customers */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Top 5 Customers by Revenue (YTD)</p>
          {topCustomers.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs">No revenue data yet</p>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c: any, i: number) => {
                const maxRev = topCustomers[0]?.revenue ?? 1;
                const pct = (c.revenue / maxRev) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700 truncate max-w-[200px]">{c.name}</span>
                      <span className="text-slate-500 font-semibold">PKR {pkr(c.revenue)}</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2">
                      <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Receivables Aging */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Receivables Aging</p>
          <p className="text-xs text-slate-400 mb-4">Total: PKR {pkr(totalAging)}</p>
          {agingChartData.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs">No outstanding receivables</p>
          ) : (
            <div className="space-y-2">
              {agingChartData.map((b, i) => {
                const pct = totalAging > 0 ? (b.value / totalAging) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{ color: b.fill }}>{b.name}</span>
                      <span className="text-slate-600 font-semibold">PKR {pkr(b.value)} <span className="text-slate-400">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2.5">
                      <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: b.fill }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        {[
          { href: '/sales/reports/summary', label: '→ Sales Summary Report' },
          { href: '/sales/reports/tax-register', label: '→ FBR Output Tax Register' },
          { href: '/sales/reports/margin', label: '→ Gross Margin Report' },
          { href: '/sales/payments', label: '→ Customer Aging (Payments)' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="text-sm text-teal-600 hover:text-teal-700 hover:underline font-medium">{label}</Link>
        ))}
      </div>
    </div>
  );
}
