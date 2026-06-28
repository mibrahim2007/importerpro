import { and, eq, isNotNull, isNull, lt, notInArray, sql } from 'drizzle-orm';
import {
  notifications,
  notificationPreferences,
  shipmentContainers, shipments,
  letterOfCredits,
  purchaseOrders,
  goodsDeclarations,
  indents,
  vendorBills,
  grns,
} from '@/db/schema';

const MS_DAY = 86_400_000;
const todayStr = () => new Date().toISOString().split('T')[0];
const diffDays = (future: string) =>
  Math.ceil((new Date(future).getTime() - Date.now()) / MS_DAY);

type TenantDb = Awaited<ReturnType<typeof import('@/db').getTenantDb>>;

interface AlertDef {
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'info';
  referenceType: string;
  referenceId: string;
  referenceNo: string;
  title: string;
  body: string;
}

export async function runAlertScan(tdb: TenantDb, userId: string): Promise<number> {
  const today = todayStr();
  const alerts: AlertDef[] = [];

  // ── 1. Demurrage alerts ────────────────────────────────────────────────────
  const containers = await tdb
    .select({
      id: shipmentContainers.id,
      containerNo: shipmentContainers.containerNo,
      portFreeDays: shipmentContainers.portFreeDays,
      portArrivalDate: shipmentContainers.portArrivalDate,
      portClearanceDate: shipmentContainers.portClearanceDate,
      demurrageRatePerDay: shipmentContainers.demurrageRatePerDay,
      demurrageCurrency: shipmentContainers.demurrageCurrency,
      shipmentId: shipmentContainers.shipmentId,
      shipmentNo: shipments.shipmentNo,
    })
    .from(shipmentContainers)
    .innerJoin(shipments, eq(shipments.id, shipmentContainers.shipmentId))
    .where(
      and(
        isNotNull(shipmentContainers.portArrivalDate),
        isNull(shipmentContainers.portClearanceDate),
        notInArray(shipments.status, ['grn_done', 'cancelled']),
      )
    );

  for (const c of containers) {
    if (!c.portArrivalDate || !c.portFreeDays) continue;
    const freeDayEnd = new Date(c.portArrivalDate);
    freeDayEnd.setDate(freeDayEnd.getDate() + c.portFreeDays);
    const freeDayStr = freeDayEnd.toISOString().split('T')[0];
    const daysLeft = diffDays(freeDayStr);
    if (daysLeft <= 7) {
      const priority = daysLeft <= 3 ? 'critical' : 'high';
      alerts.push({
        type: daysLeft <= 3 ? 'demurrage_critical' : 'demurrage_warning',
        priority,
        referenceType: 'shipment',
        referenceId: c.shipmentId,
        referenceNo: c.shipmentNo ?? '',
        title: `Demurrage Due in ${daysLeft} Day${daysLeft === 1 ? '' : 's'} — ${c.containerNo}`,
        body: `Container ${c.containerNo} on ${c.shipmentNo}. Free days end: ${freeDayStr}. ${c.demurrageRatePerDay ? `Rate: ${c.demurrageCurrency} ${c.demurrageRatePerDay}/day.` : ''} Collect immediately.`,
      });
    }
  }

  // ── 2. LC expiry alerts ────────────────────────────────────────────────────
  const lcs = await tdb
    .select({ id: letterOfCredits.id, lcNo: letterOfCredits.lcNo, expiryDate: letterOfCredits.expiryDate, status: letterOfCredits.status })
    .from(letterOfCredits)
    .where(notInArray(letterOfCredits.status, ['retired', 'expired', 'cancelled']));

  for (const lc of lcs) {
    if (!lc.expiryDate) continue;
    const daysLeft = diffDays(lc.expiryDate);
    if (daysLeft <= 15) {
      alerts.push({
        type: daysLeft <= 7 ? 'lc_expiry_critical' : 'lc_expiry_warning',
        priority: daysLeft <= 7 ? 'critical' : 'high',
        referenceType: 'lc',
        referenceId: lc.id,
        referenceNo: lc.lcNo,
        title: `LC Expiry in ${daysLeft} Day${daysLeft === 1 ? '' : 's'} — ${lc.lcNo}`,
        body: `Letter of Credit ${lc.lcNo} expires on ${lc.expiryDate}. ${daysLeft <= 7 ? 'URGENT: Amend or ensure shipment dispatched immediately.' : 'Ensure shipment and documents on track.'}`,
      });
    }
  }

  // ── 3. Latest shipment date alert ──────────────────────────────────────────
  const pos = await tdb
    .select({ id: purchaseOrders.id, poNo: purchaseOrders.poNo, latestShipDate: purchaseOrders.latestShipDate, status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(notInArray(purchaseOrders.status, ['goods_dispatched', 'fully_received', 'cancelled']));

  for (const po of pos) {
    if (!po.latestShipDate) continue;
    const daysLeft = diffDays(po.latestShipDate);
    if (daysLeft <= 7) {
      alerts.push({
        type: 'latest_ship_date_warning',
        priority: 'critical',
        referenceType: 'purchase_order',
        referenceId: po.id,
        referenceNo: po.poNo,
        title: `Latest Ship Date in ${daysLeft} Day${daysLeft === 1 ? '' : 's'} — ${po.poNo}`,
        body: `PO ${po.poNo} must be shipped by ${po.latestShipDate} per LC terms. Confirm dispatch with supplier immediately.`,
      });
    }
  }

  // ── 4. GD not filed (ATA + 2 days) ────────────────────────────────────────
  const arrivedShipments = await tdb
    .select({ id: shipments.id, shipmentNo: shipments.shipmentNo, ata: shipments.ata })
    .from(shipments)
    .where(
      and(
        notInArray(shipments.status, ['customs_cleared', 'grn_done', 'cancelled']),
        isNotNull(shipments.ata),
      )
    );

  for (const sh of arrivedShipments) {
    if (!sh.ata) continue;
    const daysElapsed = Math.floor((Date.now() - new Date(sh.ata).getTime()) / MS_DAY);
    if (daysElapsed >= 2) {
      const gdCount = await tdb
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(goodsDeclarations)
        .where(and(eq(goodsDeclarations.shipmentId, sh.id), notInArray(goodsDeclarations.status, ['cancelled'])));
      if ((gdCount[0]?.c ?? 0) === 0) {
        alerts.push({
          type: 'gd_not_filed',
          priority: 'high',
          referenceType: 'shipment',
          referenceId: sh.id,
          referenceNo: sh.shipmentNo,
          title: `GD Not Filed — ${sh.shipmentNo} Arrived ${daysElapsed} Days Ago`,
          body: `Shipment ${sh.shipmentNo} arrived on ${sh.ata} but no Goods Declaration has been filed. File GD immediately to avoid demurrage.`,
        });
      }
    }
  }

  // ── 5. Indent pending approval > 48h ──────────────────────────────────────
  const pendingIndents = await tdb
    .select({ id: indents.id, indentNo: indents.indentNo, createdAt: indents.createdAt })
    .from(indents)
    .where(eq(indents.status, 'submitted'));

  for (const indent of pendingIndents) {
    if (!indent.createdAt) continue;
    const hoursOld = (Date.now() - new Date(indent.createdAt).getTime()) / 3_600_000;
    if (hoursOld >= 48) {
      alerts.push({
        type: 'indent_pending_approval',
        priority: 'medium',
        referenceType: 'indent',
        referenceId: indent.id,
        referenceNo: indent.indentNo,
        title: `Indent Pending Approval — ${indent.indentNo}`,
        body: `Indent ${indent.indentNo} has been awaiting approval for ${Math.floor(hoursOld)} hours. Review and approve or reject.`,
      });
    }
  }

  // ── 6. Vendor bill overdue ─────────────────────────────────────────────────
  const overdueBills = await tdb
    .select({ id: vendorBills.id, billNo: vendorBills.billNo, dueDate: vendorBills.dueDate, balanceDue: vendorBills.balanceDue })
    .from(vendorBills)
    .where(
      and(
        notInArray(vendorBills.status, ['draft', 'paid', 'cancelled']),
        isNotNull(vendorBills.dueDate),
        lt(vendorBills.dueDate, today),
      )
    );

  for (const bill of overdueBills) {
    if (!bill.dueDate) continue;
    const daysOverdue = Math.floor((Date.now() - new Date(bill.dueDate).getTime()) / MS_DAY);
    alerts.push({
      type: 'vendor_bill_overdue',
      priority: 'high',
      referenceType: 'vendor_bill',
      referenceId: bill.id,
      referenceNo: bill.billNo,
      title: `Vendor Bill Overdue ${daysOverdue} Days — ${bill.billNo}`,
      body: `Bill ${bill.billNo} was due on ${bill.dueDate}. Outstanding: PKR ${parseFloat(bill.balanceDue ?? '0').toLocaleString('en-PK', { minimumFractionDigits: 2 })}. Process payment immediately.`,
    });
  }

  // ── 7. GRN QC hold > 3 days ───────────────────────────────────────────────
  const qcHoldGrns = await tdb
    .select({ id: grns.id, grnNo: grns.grnNo, postedAt: grns.postedAt })
    .from(grns)
    .where(eq(grns.status, 'qc_hold'));

  for (const grn of qcHoldGrns) {
    if (!grn.postedAt) continue;
    const daysHeld = Math.floor((Date.now() - new Date(grn.postedAt).getTime()) / MS_DAY);
    if (daysHeld >= 3) {
      alerts.push({
        type: 'grn_qc_hold',
        priority: 'medium',
        referenceType: 'grn',
        referenceId: grn.id,
        referenceNo: grn.grnNo,
        title: `GRN QC Hold ${daysHeld} Days — ${grn.grnNo}`,
        body: `GRN ${grn.grnNo} has been in QC Hold for ${daysHeld} days. Release or reject held stock to update inventory.`,
      });
    }
  }

  // ── 8. GD examination today ───────────────────────────────────────────────
  const examToday = await tdb
    .select({ id: goodsDeclarations.id, gdNo: goodsDeclarations.gdNo })
    .from(goodsDeclarations)
    .where(
      and(
        eq(goodsDeclarations.examinationDate, today),
        notInArray(goodsDeclarations.status, ['duty_paid', 'cleared', 'cancelled']),
      )
    );

  for (const gd of examToday) {
    alerts.push({
      type: 'examination_today',
      priority: 'critical',
      referenceType: 'goods_declaration',
      referenceId: gd.id,
      referenceNo: gd.gdNo ?? '',
      title: `Examination Scheduled Today — ${gd.gdNo}`,
      body: `GD ${gd.gdNo} is scheduled for examination today. Ensure clearing agent and documents are ready at the customs station.`,
    });
  }

  // ── Load user preferences (disabled types) ────────────────────────────────
  const prefRows = await tdb
    .select({ alertType: notificationPreferences.alertType, enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.enabled, false)));
  const disabledTypes = new Set(prefRows.map(r => r.alertType));

  // ── Deduplicate and insert ─────────────────────────────────────────────────
  let created = 0;
  for (const a of alerts) {
    if (disabledTypes.has(a.type)) continue;
    const alertKey = `${a.type}:${a.referenceId}:${today}`;
    const existing = await tdb
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.alertKey, alertKey)))
      .limit(1);
    if (existing.length > 0) continue;

    await tdb.insert(notifications).values({
      userId,
      type: a.type,
      priority: a.priority,
      title: a.title,
      body: a.body,
      referenceType: a.referenceType,
      referenceId: a.referenceId,
      referenceNo: a.referenceNo,
      alertKey,
    });
    created++;
  }

  return created;
}
