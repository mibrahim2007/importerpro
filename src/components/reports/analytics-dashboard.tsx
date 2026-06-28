'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TEAL_PALETTE = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'];
const COUNTRY_COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#f97316'];

const pkrM = (v: string | null) => v ? `${(parseFloat(v) / 1_000_000).toFixed(1)}M` : '0';
const usdK = (v: string | null) => v ? `$${(parseFloat(v) / 1000).toFixed(0)}K` : '0';

const shortMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
};

interface Props {
  monthlyImport: { month: string; cifUsd: string | null; cifPkr: string | null; poCount: number }[];
  supplierDiversity: { country: string | null; count: number; value: string | null }[];
  topProducts: { productName: string; productCode: string | null; totalQty: string | null; uom: string | null }[];
  stockByWarehouse: { warehouseName: string; productCount: number; totalQty: string | null }[];
  dutyMonthly: { month: string | null; totalDuty: string | null; totalSt: string | null; totalPayable: string | null }[];
  lcExposure: { currency: string | null; totalOpen: string | null; count: number }[];
  demurrageByMonth: { month: string | null; totalDemurrage: string | null; count: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

export function AnalyticsDashboard({ monthlyImport, supplierDiversity, topProducts, stockByWarehouse, dutyMonthly, lcExposure, demurrageByMonth }: Props) {
  const importData = monthlyImport.map((m) => ({
    month: shortMonth(m.month),
    'CIF USD': Math.round(parseFloat(m.cifUsd ?? '0')),
    'PO Count': m.poCount,
  }));

  const dutyData = dutyMonthly.map((m) => ({
    month: m.month ? shortMonth(m.month) : '—',
    'Customs Duty': Math.round(parseFloat(m.totalDuty ?? '0') / 1000),
    'Sales Tax': Math.round(parseFloat(m.totalSt ?? '0') / 1000),
    'Total': Math.round(parseFloat(m.totalPayable ?? '0') / 1000),
  }));

  const diversityData = supplierDiversity.slice(0, 6).map((d) => ({
    name: d.country ?? 'Unknown',
    value: Math.round(parseFloat(d.value ?? '0')),
    count: d.count,
  }));

  const productData = topProducts.map((p) => ({
    name: p.productCode ?? p.productName.slice(0, 15),
    fullName: p.productName,
    qty: Math.round(parseFloat(p.totalQty ?? '0')),
    uom: p.uom ?? '',
  }));

  const warehouseData = stockByWarehouse.map((w) => ({
    name: w.warehouseName,
    qty: Math.round(parseFloat(w.totalQty ?? '0')),
    products: w.productCount,
  }));

  const demurrageData = demurrageByMonth
    .filter((d) => d.month)
    .map((d) => ({
      month: shortMonth(d.month!),
      'Demurrage USD': Math.round(parseFloat(d.totalDemurrage ?? '0')),
      'Incidents': d.count,
    }));

  const totalLcExposure = lcExposure.reduce((s, l) => s + parseFloat(l.totalOpen ?? '0'), 0);
  const totalDemurrage = demurrageByMonth.reduce((s, d) => s + parseFloat(d.totalDemurrage ?? '0'), 0);

  const EMPTY = <p className="text-center py-8 text-slate-400 text-sm">No data yet</p>;

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* 1. Import Volume Trend */}
      <Card className="col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Import Volume Trend — Monthly CIF (USD)</CardTitle></CardHeader>
        <CardContent>
          {importData.length === 0 ? EMPTY : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={importData}>
                <defs>
                  <linearGradient id="cifGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="CIF USD" stroke="#0d9488" fill="url(#cifGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 2. Duty Expense */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Duty & Tax Payments — Monthly (PKR 000s)</CardTitle></CardHeader>
        <CardContent>
          {dutyData.length === 0 ? EMPTY : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dutyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Customs Duty" fill="#0d9488" stackId="a" />
                <Bar dataKey="Sales Tax" fill="#14b8a6" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 3. Supplier Diversity */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Supplier Diversity — by Country of Origin</CardTitle></CardHeader>
        <CardContent>
          {diversityData.length === 0 ? EMPTY : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={diversityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {diversityData.map((_, i) => <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 4. Top 10 Products */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 Products by Import Volume</CardTitle></CardHeader>
        <CardContent>
          {productData.length === 0 ? EMPTY : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productData} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="qty" fill="#0d9488" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="qty" position="right" style={{ fontSize: 10, fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 5. Stock by Warehouse */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Stock Distribution by Warehouse</CardTitle></CardHeader>
        <CardContent>
          {warehouseData.length === 0 ? EMPTY : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={warehouseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="qty" fill="#2dd4bf" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="products" position="top" style={{ fontSize: 10, fill: '#64748b' }} formatter={(v: number) => `${v} SKU`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 6. Open LC Exposure */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Open LC Exposure</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-3xl font-bold text-teal-700">USD {totalLcExposure.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            <p className="text-sm text-slate-400 mt-1">Total open LC value</p>
          </div>
          <div className="space-y-2">
            {lcExposure.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{l.currency} ({l.count} LC{l.count !== 1 ? 's' : ''})</span>
                <span className="font-mono font-semibold text-slate-800">{l.currency} {parseFloat(l.totalOpen ?? '0').toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
              </div>
            ))}
            {lcExposure.length === 0 && <p className="text-center text-slate-400 text-sm">No open LCs</p>}
          </div>
        </CardContent>
      </Card>

      {/* 7. Demurrage Trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Demurrage Trend (USD)</CardTitle>
            <span className="text-sm font-semibold text-red-600">Total: ${totalDemurrage.toLocaleString()}</span>
          </div>
        </CardHeader>
        <CardContent>
          {demurrageData.length === 0 ? EMPTY : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={demurrageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Demurrage USD" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
