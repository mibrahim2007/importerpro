import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { dispatchChallans, dispatchChallanLines, salesOrders, customers, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Truck, Package, Weight, FileText } from 'lucide-react';
import { DcActions } from '@/components/sales/dc-actions';

export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500', approved: 'bg-amber-100 text-amber-700',
  gate_pass_issued: 'bg-blue-100 text-blue-700', in_transit: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700', returned: 'bg-red-100 text-red-600',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', approved: 'Approved', gate_pass_issued: 'Gate Pass Issued',
  in_transit: 'In Transit', delivered: 'Delivered', returned: 'Returned',
};
const STEPS = ['draft', 'approved', 'gate_pass_issued', 'in_transit', 'delivered'];

export default async function DcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[dc], lines] = await Promise.all([
    tdb.select({
      id: dispatchChallans.id, dcNo: dispatchChallans.dcNo, dcDate: dispatchChallans.dcDate,
      status: dispatchChallans.status, soId: dispatchChallans.soId,
      vehicleNo: dispatchChallans.vehicleNo, driverName: dispatchChallans.driverName,
      driverCnic: dispatchChallans.driverCnic, transportCompany: dispatchChallans.transportCompany,
      freightResponsibility: dispatchChallans.freightResponsibility,
      freightChargesPkr: dispatchChallans.freightChargesPkr,
      gatePassNo: dispatchChallans.gatePassNo, gateOutTime: dispatchChallans.gateOutTime,
      estimatedArrivalDate: dispatchChallans.estimatedArrivalDate,
      deliveryConfirmedDate: dispatchChallans.deliveryConfirmedDate,
      warehouseId: dispatchChallans.warehouseId,
      notes: dispatchChallans.notes, createdAt: dispatchChallans.createdAt,
      customerId: dispatchChallans.customerId,
      soNo: salesOrders.soNo,
      customerName: customers.name, customerCode: customers.code,
      customerNtn: customers.ntn, customerBillingAddress: customers.billingAddress,
    })
    .from(dispatchChallans)
    .leftJoin(salesOrders, eq(salesOrders.id, dispatchChallans.soId))
    .leftJoin(customers, eq(customers.id, dispatchChallans.customerId))
    .where(eq(dispatchChallans.id, id)).limit(1),

    tdb.select({
      id: dispatchChallanLines.id, soLineId: dispatchChallanLines.soLineId,
      productId: dispatchChallanLines.productId, lotBatchNo: dispatchChallanLines.lotBatchNo,
      expiryDate: dispatchChallanLines.expiryDate, dispatchedQty: dispatchChallanLines.dispatchedQty,
      uom: dispatchChallanLines.uom, grossWeightKg: dispatchChallanLines.grossWeightKg,
      netWeightKg: dispatchChallanLines.netWeightKg, packageCount: dispatchChallanLines.packageCount,
      packageType: dispatchChallanLines.packageType, weighmentSlipNo: dispatchChallanLines.weighmentSlipNo,
      qualityCertNo: dispatchChallanLines.qualityCertNo, sortOrder: dispatchChallanLines.sortOrder,
      productName: products.name, productCode: products.code,
    })
    .from(dispatchChallanLines)
    .leftJoin(products, eq(products.id, dispatchChallanLines.productId))
    .where(eq(dispatchChallanLines.dcId, id))
    .orderBy(dispatchChallanLines.sortOrder),
  ]);

  if (!dc) notFound();

  const totalNetWeight = lines.reduce((s, l) => s + parseFloat(l.netWeightKg ?? '0'), 0);
  const totalGrossWeight = lines.reduce((s, l) => s + parseFloat(l.grossWeightKg ?? '0'), 0);
  const totalPackages = lines.reduce((s, l) => s + (l.packageCount ?? 0), 0);
  const totalQty = lines.reduce((s, l) => s + parseFloat(l.dispatchedQty), 0);

  const currentStep = STEPS.indexOf(dc.status ?? 'draft');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/sales/dispatch"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{dc.dcNo}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[dc.status ?? ''] ?? ''}`}>
              {STATUS_LABEL[dc.status ?? ''] ?? dc.status}
            </span>
            {dc.gatePassNo && (
              <span className="px-2 py-0.5 rounded text-xs font-mono text-slate-500 bg-slate-100">GP: {dc.gatePassNo}</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{dc.customerName} · SO: {dc.soNo} · {dc.dcDate}</p>
        </div>
        <Link href={`/sales/orders/${dc.soId}`}>
          <Button variant="outline" size="sm">View SO →</Button>
        </Link>
        {dc.status === 'delivered' && (
          <Link href={`/sales/invoices/new?dcId=${id}`}>
            <Button className="bg-teal-600 hover:bg-teal-700" size="sm">Create Invoice →</Button>
          </Link>
        )}
      </div>

      {/* Progress stepper */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`flex flex-col items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= currentStep ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {i + 1}
                </div>
                <p className={`text-[10px] mt-1 text-center ${i <= currentStep ? 'text-teal-700 font-medium' : 'text-slate-400'}`}>
                  {STATUS_LABEL[step]}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < currentStep ? 'bg-teal-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Line Items */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Dispatched Items</CardTitle>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Weight className="h-3.5 w-3.5" />Net: {totalNetWeight.toFixed(1)} kg</span>
                  <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{totalPackages} packages</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {['#', 'Product', 'Lot No', 'Expiry', 'Qty', 'UOM', 'Gross Wt', 'Net Wt', 'Packages', 'Weighment', 'QC Cert'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-700">{l.productName ?? '—'}</p>
                          {l.productCode && <p className="text-xs text-slate-400">{l.productCode}</p>}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-teal-700">{l.lotBatchNo ?? '—'}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">{l.expiryDate ?? '—'}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{l.dispatchedQty}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">{l.uom}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">{l.grossWeightKg ? `${l.grossWeightKg} kg` : '—'}</td>
                        <td className="px-3 py-3 text-xs font-medium">{l.netWeightKg ? `${l.netWeightKg} kg` : '—'}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {l.packageCount ? `${l.packageCount} ${l.packageType ?? 'pkgs'}` : '—'}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-500">{l.weighmentSlipNo ?? '—'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-500">{l.qualityCertNo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t font-semibold text-sm">
                      <td colSpan={4} className="px-3 py-2.5 text-slate-500 text-xs">TOTALS</td>
                      <td className="px-3 py-2.5">{totalQty.toLocaleString('en-PK', { maximumFractionDigits: 1 })}</td>
                      <td />
                      <td className="px-3 py-2.5 text-xs">{totalGrossWeight.toFixed(1)} kg</td>
                      <td className="px-3 py-2.5 text-xs">{totalNetWeight.toFixed(1)} kg</td>
                      <td className="px-3 py-2.5 text-xs">{totalPackages}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {dc.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600">{dc.notes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-0">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Dispatch Info</p>
              {[
                { label: 'DC No', value: dc.dcNo },
                { label: 'Date', value: dc.dcDate },
                { label: 'Freight', value: dc.freightResponsibility === 'to_door' ? `To-Door · PKR ${parseFloat(dc.freightChargesPkr ?? '0').toLocaleString('en-PK')}` : 'Ex-Works' },
                { label: 'Vehicle', value: dc.vehicleNo ?? '—' },
                { label: 'Driver', value: dc.driverName ?? '—' },
                { label: 'Driver CNIC', value: dc.driverCnic ?? '—' },
                { label: 'Transporter', value: dc.transportCompany ?? '—' },
                { label: 'Gate Pass', value: dc.gatePassNo ?? '—' },
                { label: 'Gate Out', value: dc.gateOutTime ? new Date(String(dc.gateOutTime)).toLocaleString('en-PK') : '—' },
                { label: 'Est. Arrival', value: dc.estimatedArrivalDate ?? '—' },
                { label: 'Delivered On', value: dc.deliveryConfirmedDate ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-medium text-right max-w-[160px] break-words">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-sm space-y-1">
              <p className="text-xs text-slate-400 mb-2">Bill To</p>
              <p className="font-semibold text-slate-800">{dc.customerName}</p>
              {dc.customerBillingAddress && <p className="text-slate-500 text-xs">{dc.customerBillingAddress}</p>}
              {dc.customerNtn && <p className="text-xs text-slate-400">NTN: {dc.customerNtn}</p>}
            </CardContent>
          </Card>

          <DcActions dcId={id} status={dc.status ?? 'draft'} gatePassNo={dc.gatePassNo} />
        </div>
      </div>
    </div>
  );
}
