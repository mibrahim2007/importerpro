import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { approvalRules } from '@/db/schema';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ApprovalRuleActions } from '@/components/settings/approval-rule-actions';
import { GitMerge, ArrowRight } from 'lucide-react';

const MODULE_LABELS: Record<string, string> = {
  indent: 'Purchase Indent (PR)',
  po: 'Purchase Order (PO)',
  payment: 'Payment',
};

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Tenant Admin',
  procurement_manager: 'Procurement Manager',
  finance_manager: 'Finance Manager',
  warehouse_manager: 'Warehouse Manager',
};

const OPERATOR_LABELS: Record<string, string> = {
  '>': 'greater than',
  '>=': 'at least',
  '<': 'less than',
  '=': 'equal to',
  'always': 'always',
};

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const tdb = await getTenantDb(session.user.tenantSlug);
  const rules = await tdb.select().from(approvalRules).orderBy(approvalRules.module, approvalRules.sequence);

  const grouped = rules.reduce<Record<string, typeof rules>>((acc, r) => {
    acc[r.module] = acc[r.module] ?? [];
    acc[r.module].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Approval Workflows</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define who must approve indents, POs, and payments before they proceed</p>
        </div>
        <ApprovalRuleActions mode="create" />
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitMerge className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No approval rules configured</p>
            <p className="text-sm text-slate-400 mt-1">Without rules, all documents are auto-approved. Add rules to enforce sign-off by specific roles.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([module, moduleRules]) => (
          <Card key={module}>
            <div className="px-4 py-2.5 border-b bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">{MODULE_LABELS[module] ?? module}</p>
            </div>
            <CardContent className="p-0">
              {moduleRules.map((rule, i) => (
                <div key={rule.id} className="flex items-center gap-3 px-4 py-3 border-b hover:bg-slate-50 text-sm">
                  <div className="h-6 w-6 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 text-xs font-bold shrink-0">
                    {rule.sequence}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{rule.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {rule.conditionField && rule.conditionOperator !== 'always'
                        ? `When ${rule.conditionField} ${OPERATOR_LABELS[rule.conditionOperator ?? ''] ?? rule.conditionOperator} ${rule.conditionValue}`
                        : 'Always required'}
                      {' → '}
                      <span className="font-medium text-teal-700">
                        {ROLE_LABELS[rule.approverRole] ?? rule.approverRole} must approve
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {rule.isActive ? 'Active' : 'Off'}
                    </span>
                    <ApprovalRuleActions mode="edit" rule={rule} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
