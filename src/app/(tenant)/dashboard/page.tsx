import { auth } from '@/lib/auth/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Ship, FileText, CreditCard, Package,
  TrendingUp, AlertTriangle, CheckCircle, Clock
} from 'lucide-react';

const kpiCards = [
  {
    title: 'Active Consignments',
    value: '—',
    icon: Ship,
    description: 'Currently in progress',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Open LCs',
    value: '—',
    icon: CreditCard,
    description: 'Total value pending',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    title: 'POs Pending Shipment',
    value: '—',
    icon: FileText,
    description: 'Awaiting dispatch',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    title: 'GDs Under Examination',
    value: '—',
    icon: Package,
    description: 'At customs',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    title: 'Sales Revenue (MTD)',
    value: '—',
    icon: TrendingUp,
    description: 'Month to date',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    title: 'Outstanding Receivables',
    value: '—',
    icon: AlertTriangle,
    description: 'Total unpaid invoices',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    title: 'Active Sales Orders',
    value: '—',
    icon: CheckCircle,
    description: 'Confirmed, pending dispatch',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Gross Margin % (MTD)',
    value: '—',
    icon: TrendingUp,
    description: 'Revenue vs landed cost',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
];

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back, {session?.user.name ?? session?.user.email}
          </p>
        </div>
        <Badge variant="outline" className="text-teal-700 border-teal-300 bg-teal-50">
          <Clock className="h-3 w-3 mr-1" />
          Live
        </Badge>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <p className="text-xs text-slate-500 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Import Value</CardTitle>
          </CardHeader>
          <CardContent className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Charts will load once data is available
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Consignments by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Charts will load once data is available
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Upcoming Actions</CardTitle>
        </CardHeader>
        <CardContent className="text-slate-400 text-sm text-center py-8">
          No pending actions — system is ready.
        </CardContent>
      </Card>
    </div>
  );
}
