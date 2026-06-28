import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { FileBarChart, FileText, CreditCard, BarChart2, Package, Users, Ship, ClipboardList, TrendingUp } from 'lucide-react';

const REPORTS = [
  { href: '/reports/consignment-tracker', icon: Ship, label: 'Consignment Tracker', desc: 'All consignments with live status, port dwell, GD, and GRN details.' },
  { href: '/reports/duty-register', icon: FileText, label: 'Import Duty Register', desc: 'FBR-compliant GD duty register with HS codes, CD, ST, WHT, RD per line.' },
  { href: '/reports/lc-register', icon: CreditCard, label: 'LC Register', desc: 'All LCs with beneficiary, amount, expiry, status, and total bank charges.' },
  { href: '/reports/landed-cost', icon: FileBarChart, label: 'Landed Cost Report', desc: 'Per-consignment cost breakdown: CIF, duty, clearing, port, bank, inland, per-unit.' },
  { href: '/reports/stock-aging', icon: Package, label: 'Stock Aging Report', desc: 'Stock by lot with receipt date, age in days, and warehouse location.' },
  { href: '/reports/supplier-performance', icon: Users, label: 'Supplier Performance', desc: 'PO count, avg lead time, on-time delivery rate, price variance vs quote.' },
  { href: '/reports/port-dwell', icon: Ship, label: 'Port Dwell Time', desc: 'Avg berth-to-gate days per port, demurrage incidence, and total cost.' },
  { href: '/reports/open-po', icon: ClipboardList, label: 'Open PO Status', desc: 'Ordered vs shipped vs received qty, pending, and estimated arrival.' },
  { href: '/reports/analytics', icon: TrendingUp, label: 'Analytics Dashboard', desc: 'Interactive charts: import trends, duty heatmap, supplier diversity, stock values.' },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports & BI</h1>
        <p className="text-sm text-slate-500 mt-0.5">Standard reports and analytics for import operations</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="h-full hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group">
              <CardContent className="p-5">
                <r.icon className="h-6 w-6 text-teal-600 mb-3 group-hover:text-teal-700" />
                <h3 className="font-semibold text-slate-800 text-sm mb-1">{r.label}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
