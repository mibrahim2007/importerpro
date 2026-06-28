import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { goodsDeclarations, gdLines } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Status machine: what statuses can transition to each action
const ALLOWED_FROM: Record<string, string[]> = {
  file:              ['draft'],
  assign_green:      ['filed'],
  assign_yellow:     ['filed'],
  assign_red:        ['filed'],
  raise_query:       ['filed', 'yellow_channel', 'red_channel'],
  reply_query:       ['query_raised'],
  examination_done:  ['red_channel'],
  assessment_order:  ['yellow_channel', 'red_channel', 'examination_done', 'query_replied'],
  pay_duty:          ['assessment_ordered', 'green_channel'],
  clear:             ['duty_paid', 'green_channel'],
  cancel:            ['draft', 'filed'],
};

const ACTION_STATUS: Record<string, string> = {
  file:             'filed',
  assign_green:     'green_channel',
  assign_yellow:    'yellow_channel',
  assign_red:       'red_channel',
  raise_query:      'query_raised',
  reply_query:      'query_replied',
  examination_done: 'examination_done',
  assessment_order: 'assessment_ordered',
  pay_duty:         'duty_paid',
  clear:            'cleared',
  cancel:           'cancelled',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const [[gd], lines] = await Promise.all([
    tdb.select().from(goodsDeclarations).where(eq(goodsDeclarations.id, id)).limit(1),
    tdb.select().from(gdLines).where(eq(gdLines.gdId, id)).orderBy(gdLines.sortOrder),
  ]);
  if (!gd) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...gd, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.tenantSlug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const tdb = await getTenantDb(session.user.tenantSlug);
  const body = await req.json();

  const [current] = await tdb.select({ status: goodsDeclarations.status })
    .from(goodsDeclarations).where(eq(goodsDeclarations.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action, ...fields } = body;

  if (action) {
    const allowed = ALLOWED_FROM[action];
    if (!allowed) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    if (!allowed.includes(current.status ?? '')) {
      return NextResponse.json({ error: `Cannot ${action} from status "${current.status}"` }, { status: 422 });
    }
    const newStatus = ACTION_STATUS[action] as any;
    const update: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
    const today = new Date().toISOString().split('T')[0];

    if (action === 'file') {
      if (fields.gdNo) update.gdNo = fields.gdNo;
      update.gdDate = fields.gdDate || today;
      if (fields.channel) update.channel = fields.channel;
    }
    if (action === 'assign_green') { update.channel = 'green'; }
    if (action === 'assign_yellow') { update.channel = 'yellow'; }
    if (action === 'assign_red') { update.channel = 'red'; }
    if (action === 'raise_query') {
      update.queryText = fields.queryText;
      update.queryRaisedDate = fields.queryRaisedDate || today;
    }
    if (action === 'reply_query') {
      update.queryReply = fields.queryReply;
      update.queryRepliedDate = fields.queryRepliedDate || today;
    }
    if (action === 'examination_done') {
      update.examinationDate = fields.examinationDate || today;
      update.examinationOfficer = fields.examinationOfficer || null;
      update.examinationLocation = fields.examinationLocation || null;
      update.examinationFindings = fields.examinationFindings || 'clear';
      update.examinationReportNo = fields.examinationReportNo || null;
      update.examinationChargesPkr = fields.examinationChargesPkr ? String(fields.examinationChargesPkr) : null;
    }
    if (action === 'assessment_order') {
      update.aoNo = fields.aoNo || null;
      update.aoDate = fields.aoDate || today;
      if (fields.totalPayablePkr) update.totalPayablePkr = String(fields.totalPayablePkr);
    }
    if (action === 'pay_duty') {
      update.psidNo = fields.psidNo;
      update.psidDate = fields.psidDate || today;
      update.psidBankName = fields.psidBankName || null;
      update.psidAmountPkr = fields.psidAmountPkr ? String(fields.psidAmountPkr) : null;
    }
    if (action === 'clear') {
      update.gdClearedDate = fields.gdClearedDate || today;
    }

    const [updated] = await tdb.update(goodsDeclarations).set(update as any)
      .where(eq(goodsDeclarations.id, id)).returning();
    return NextResponse.json(updated);
  }

  // Field update (draft only)
  if (!['draft'].includes(current.status ?? '')) {
    return NextResponse.json({ error: 'Can only edit draft GDs' }, { status: 422 });
  }

  const EDITABLE = ['gdNo', 'gdDate', 'gdType', 'shipmentId', 'clearingAgentName', 'customsStation',
    'importRegNo', 'ntn', 'strn', 'exchangeRate', 'srosApplied', 'notes'];
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of EDITABLE) {
    if (k in fields) update[k] = fields[k] ?? null;
  }

  const [updated] = await tdb.update(goodsDeclarations).set(update as any)
    .where(eq(goodsDeclarations.id, id)).returning();
  return NextResponse.json(updated);
}
