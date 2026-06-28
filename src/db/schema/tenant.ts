import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  date,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const priorityEnum = pgEnum('priority', ['low', 'normal', 'urgent', 'critical']);
export const indentStatusEnum = pgEnum('indent_status', ['draft', 'submitted', 'under_review', 'approved', 'rfq_created', 'po_confirmed', 'closed', 'rejected', 'cancelled']);
export const rfqStatusEnum = pgEnum('rfq_status', ['draft', 'sent', 'quotes_received', 'comparison_done', 'po_created', 'cancelled']);
export const poStatusEnum = pgEnum('po_status', ['draft', 'confirmed', 'lc_requested', 'lc_opened', 'goods_dispatched', 'partially_received', 'fully_received', 'invoiced', 'closed', 'cancelled']);
export const supplierTypeEnum = pgEnum('supplier_type', ['manufacturer', 'trader', 'clearing_agent', 'freight_forwarder', 'shipping_line', 'port_agent']);
export const incotermsEnum = pgEnum('incoterms', ['FOB', 'CFR', 'CIF', 'EXW', 'DDP']);
export const paymentTermsEnum = pgEnum('payment_terms', ['lc_sight', 'lc_30', 'lc_60', 'lc_90', 'tt_advance', 'cad', 'cash', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']);
export const currencyEnum = pgEnum('currency', ['USD', 'EUR', 'CNY', 'AED', 'GBP', 'JPY', 'PKR']);
export const uomEnum = pgEnum('uom', ['KG', 'MT', 'Liters', 'Bags', 'Drums', 'Cartons', 'Units', 'Cylinders']);
export const productCategoryEnum = pgEnum('product_category', ['raw_material', 'packing', 'consumable', 'finished_good']);
export const qualityStatusEnum = pgEnum('quality_status', ['accepted', 'rejected', 'under_qc']);

// ─── Master Tables ─────────────────────────────────────────────────────────────

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  phone: text('phone'),
  managerId: uuid('manager_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  gpsLat: numeric('gps_lat', { precision: 10, scale: 7 }),
  gpsLng: numeric('gps_lng', { precision: 10, scale: 7 }),
  isActive: boolean('is_active').default(true),
});

export const stockLocations = pgTable('stock_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').notNull(),
  name: text('name').notNull(),
  locationType: text('location_type').notNull(), // internal/view/supplier/customer/transit/inventory
  parentId: uuid('parent_id'),
  isActive: boolean('is_active').default(true),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique(),
  name: text('name').notNull(),
  category: productCategoryEnum('category').default('raw_material'),
  hsCode: text('hs_code'),
  uom: uomEnum('uom').notNull().default('KG'),
  purchaseUom: uomEnum('purchase_uom'),
  uomConversion: numeric('uom_conversion', { precision: 15, scale: 5 }).default('1'),
  reorderPoint: numeric('reorder_point', { precision: 15, scale: 3 }).default('0'),
  minStock: numeric('min_stock', { precision: 15, scale: 3 }).default('0'),
  maxStock: numeric('max_stock', { precision: 15, scale: 3 }).default('0'),
  storageConditions: text('storage_conditions'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique(),
  name: text('name').notNull(),
  country: text('country'),
  supplierType: supplierTypeEnum('supplier_type').default('manufacturer'),
  address: text('address'),
  email: text('email'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  bankName: text('bank_name'),
  bankIban: text('bank_iban'),
  bankSwift: text('bank_swift'),
  bankCurrency: currencyEnum('bank_currency').default('USD'),
  paymentTerms: paymentTermsEnum('payment_terms').default('lc_sight'),
  preferredIncoterms: incotermsEnum('preferred_incoterms').default('CIF'),
  defaultPortOfLoading: text('default_port_of_loading'),
  leadTimeDays: integer('lead_time_days'),
  complianceStatus: text('compliance_status').default('active'), // active/blacklisted/under_review
  customsLicenseNo: text('customs_license_no'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique(),
  name: text('name').notNull(),
  customerType: text('customer_type').default('manufacturer'), // manufacturer/trader/distributor/retailer/government
  ntn: text('ntn'),
  strn: text('strn'),
  cnic: text('cnic'),
  fbrStatus: text('fbr_status').default('active'), // active/non_filer/exempt
  billingAddress: text('billing_address'),
  phone: text('phone'),
  email: text('email'),
  paymentTerms: paymentTermsEnum('payment_terms').default('net_30'),
  creditLimitPkr: numeric('credit_limit_pkr', { precision: 18, scale: 2 }).default('0'),
  salesTaxCategory: text('sales_tax_category').default('registered'), // registered/unregistered/exempt
  whtRatePct: numeric('wht_rate_pct', { precision: 5, scale: 2 }).default('4.5'),
  preferredPaymentMode: text('preferred_payment_mode').default('cheque'),
  bankName: text('bank_name'),
  assignedOfficerId: uuid('assigned_officer_id'),
  branchId: uuid('branch_id'),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const customerAddresses = pgTable('customer_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(),
  label: text('label'),                         // e.g. "Factory Gate", "Head Office"
  address: text('address').notNull(),
  city: text('city'),
  isDefault: boolean('is_default').default(false),
});

export const customerContacts = pgTable('customer_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(),
  name: text('name').notNull(),
  designation: text('designation'),
  email: text('email'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  isPrimary: boolean('is_primary').default(false),
});

export const customerPricelists = pgTable('customer_pricelists', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(),
  productId: uuid('product_id').notNull(),
  priceTier: text('price_tier').default('standard'),  // standard/distributor/oem/government
  pricingBasis: text('pricing_basis').default('fixed'), // fixed/markup_pct/formula
  unitPricePkr: numeric('unit_price_pkr', { precision: 18, scale: 4 }),
  markupPct: numeric('markup_pct', { precision: 7, scale: 4 }),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Indent (Purchase Requisition) ────────────────────────────────────────────

export const indents = pgTable('indents', {
  id: uuid('id').primaryKey().defaultRandom(),
  indentNo: text('indent_no').unique().notNull(),
  date: date('date').notNull(),
  branchId: uuid('branch_id').notNull(),
  warehouseId: uuid('warehouse_id'),
  requesterId: uuid('requester_id').notNull(),
  priority: priorityEnum('priority').default('normal'),
  requiredBy: date('required_by'),
  status: indentStatusEnum('status').default('draft'),
  justification: text('justification'),
  notes: text('notes'),
  approvedById: uuid('approved_by_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const indentLines = pgTable('indent_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  indentId: uuid('indent_id').notNull(),
  productId: uuid('product_id').notNull(),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  uom: uomEnum('uom'),
  estPriceUsd: numeric('est_price_usd', { precision: 15, scale: 4 }),
  specifications: text('specifications'),
  originCountry: text('origin_country'),
  sortOrder: integer('sort_order').default(0),
});

// ─── RFQ ──────────────────────────────────────────────────────────────────────

export const rfqs = pgTable('rfqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqNo: text('rfq_no').unique().notNull(),
  indentId: uuid('indent_id'),
  dateSent: date('date_sent'),
  validUntil: date('valid_until'),
  incoterms: incotermsEnum('incoterms').default('CIF'),
  portOfDischarge: text('port_of_discharge'),
  currency: currencyEnum('currency').default('USD'),
  paymentTerms: paymentTermsEnum('payment_terms'),
  status: rfqStatusEnum('status').default('draft'),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 4 }),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const rfqLines = pgTable('rfq_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull(),
  productId: uuid('product_id').notNull(),
  specGrade: text('spec_grade'),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  uom: uomEnum('uom'),
  targetPrice: numeric('target_price', { precision: 15, scale: 4 }),
  sortOrder: integer('sort_order').default(0),
});

export const rfqSuppliers = pgTable('rfq_suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  status: text('status').default('pending'), // pending/quoted/declined
});

export const supplierQuotes = pgTable('supplier_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqSupplierId: uuid('rfq_supplier_id').notNull(),
  rfqLineId: uuid('rfq_line_id').notNull(),
  unitPrice: numeric('unit_price', { precision: 15, scale: 4 }).notNull(),
  currency: currencyEnum('currency').default('USD'),
  validityDate: date('validity_date'),
  leadTimeDays: integer('lead_time_days'),
  portOfLoading: text('port_of_loading'),
  specialTerms: text('special_terms'),
  isRecommended: boolean('is_recommended').default(false),
  recommendationNote: text('recommendation_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Purchase Orders ───────────────────────────────────────────────────────────

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  poNo: text('po_no').unique().notNull(),
  poDate: date('po_date').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  indentId: uuid('indent_id'),
  rfqId: uuid('rfq_id'),
  incoterms: incotermsEnum('incoterms').default('CIF'),
  portOfLoading: text('port_of_loading'),
  portOfDischarge: text('port_of_discharge'),
  paymentTerms: paymentTermsEnum('payment_terms').default('lc_sight'),
  currency: currencyEnum('currency').default('USD'),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 4 }),
  latestShipDate: date('latest_ship_date'),
  lcExpiryDate: date('lc_expiry_date'),
  bankIssuingLc: text('bank_issuing_lc'),
  status: poStatusEnum('status').default('draft'),
  subtotalAmount: numeric('subtotal_amount', { precision: 18, scale: 4 }),
  freightAmount: numeric('freight_amount', { precision: 18, scale: 4 }),
  insuranceAmount: numeric('insurance_amount', { precision: 18, scale: 4 }),
  cifValueUsd: numeric('cif_value_usd', { precision: 18, scale: 4 }),
  cifValuePkr: numeric('cif_value_pkr', { precision: 18, scale: 2 }),
  packingInstructions: text('packing_instructions'),
  markingInstructions: text('marking_instructions'),
  specialConditions: text('special_conditions'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const poLines = pgTable('po_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  poId: uuid('po_id').notNull(),
  productId: uuid('product_id').notNull(),
  hsCode: text('hs_code'),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  uom: uomEnum('uom'),
  unitPrice: numeric('unit_price', { precision: 15, scale: 4 }).notNull(),
  totalPrice: numeric('total_price', { precision: 18, scale: 4 }),
  sortOrder: integer('sort_order').default(0),
});

export const poAmendments = pgTable('po_amendments', {
  id: uuid('id').primaryKey().defaultRandom(),
  poId: uuid('po_id').notNull(),
  amendmentNo: integer('amendment_no').notNull(),
  fieldChanged: text('field_changed').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  reason: text('reason'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Chart of Accounts ────────────────────────────────────────────────────────

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),           // e.g. 1100, 5200
  name: text('name').notNull(),
  accountType: text('account_type').notNull(),     // asset/liability/equity/revenue/expense/cogs
  parentCode: text('parent_code'),
  isGroup: boolean('is_group').default(false),
  currency: text('currency').default('PKR'),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  isSystem: boolean('is_system').default(false),   // system accounts can't be deleted
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Approval Workflows ───────────────────────────────────────────────────────

export const approvalRules = pgTable('approval_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: text('module').notNull(),                // indent/po/payment
  name: text('name').notNull(),
  conditionField: text('condition_field'),          // e.g. totalAmount, priority
  conditionOperator: text('condition_operator'),    // >/</=/>=/<=
  conditionValue: text('condition_value'),          // e.g. 100000
  approverRole: text('approver_role').notNull(),    // role that must approve
  approverUserId: uuid('approver_user_id'),         // specific user override
  sequence: integer('sequence').default(1),        // step order in multi-level approval
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Tenant Settings (key-value store) ────────────────────────────────────────

export const tenantSettings = pgTable('tenant_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').unique().notNull(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Shipments ────────────────────────────────────────────────────────────────

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'draft', 'booked', 'sailing', 'arrived', 'do_released', 'customs_cleared', 'grn_done', 'cancelled',
]);

export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  shipmentNo: text('shipment_no').unique().notNull(),
  poId: uuid('po_id'),
  lcId: uuid('lc_id'),
  mode: text('mode').default('sea'), // sea/air/road
  // Vessel & Carrier
  vesselName: text('vessel_name'),
  voyageNo: text('voyage_no'),
  shippingLineId: uuid('shipping_line_id'), // public schema — stored as ref
  shippingLineName: text('shipping_line_name'), // denormalized for speed
  freightForwarderId: uuid('freight_forwarder_id'),
  freightForwarderName: text('freight_forwarder_name'),
  // B/L
  blNo: text('bl_no'),
  blDate: date('bl_date'),
  blType: text('bl_type').default('original'), // original/telex/seawaybill
  // Ports & Dates
  portOfLoading: text('port_of_loading'),
  portOfDischarge: text('port_of_discharge'),
  etd: date('etd'),
  atd: date('atd'),
  eta: date('eta'),
  ata: date('ata'),
  // Freight
  freightAmount: numeric('freight_amount', { precision: 15, scale: 2 }),
  freightCurrency: text('freight_currency').default('USD'),
  freightPayment: text('freight_payment').default('prepaid'), // prepaid/collect
  freightInvoiceNo: text('freight_invoice_no'),
  freightInvoiceDate: date('freight_invoice_date'),
  freightPaidDate: date('freight_paid_date'),
  // Cargo
  packageCount: integer('package_count'),
  grossWeightKg: numeric('gross_weight_kg', { precision: 15, scale: 3 }),
  netWeightKg: numeric('net_weight_kg', { precision: 15, scale: 3 }),
  volumeCbm: numeric('volume_cbm', { precision: 15, scale: 3 }),
  // DO & Port
  doNo: text('do_no'),
  doReleasedDate: date('do_released_date'),
  // Document arrival
  blReceivedAtBank: boolean('bl_received_at_bank').default(false),
  blReceivedDate: date('bl_received_date'),
  docsReleasedByBank: boolean('docs_released_by_bank').default(false),
  docsReleasedDate: date('docs_released_date'),
  docsSentToAgent: boolean('docs_sent_to_agent').default(false),
  docsSentDate: date('docs_sent_date'),
  courierTrackingNo: text('courier_tracking_no'),
  // Status
  status: shipmentStatusEnum('status').default('draft'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const shipmentContainers = pgTable('shipment_containers', {
  id: uuid('id').primaryKey().defaultRandom(),
  shipmentId: uuid('shipment_id').notNull(),
  containerNo: text('container_no').notNull(),
  sealNo: text('seal_no'),
  containerType: text('container_type').default('20GP'), // 20GP/40GP/40HC/LCL
  // Demurrage tracking
  portFreeDays: integer('port_free_days').default(7),
  detentionFreeDays: integer('detention_free_days').default(7),
  demurrageRatePerDay: numeric('demurrage_rate_per_day', { precision: 10, scale: 2 }),
  demurrageCurrency: text('demurrage_currency').default('USD'),
  portArrivalDate: date('port_arrival_date'),
  portClearanceDate: date('port_clearance_date'), // when container left port
  emptyReturnDate: date('empty_return_date'),
  demurrageInvoiceNo: text('demurrage_invoice_no'),
  demurragePaidAmount: numeric('demurrage_paid_amount', { precision: 15, scale: 2 }),
});

// ─── Letter of Credit ─────────────────────────────────────────────────────────

export const lcStatusEnum = pgEnum('lc_status', [
  'draft', 'applied', 'opened', 'documents_presented',
  'under_scrutiny', 'accepted', 'retired', 'expired', 'cancelled',
]);

export const letterOfCredits = pgTable('letter_of_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  lcNo: text('lc_no').unique().notNull(),
  poId: uuid('po_id'),
  supplierId: uuid('supplier_id').notNull(),
  lcType: text('lc_type').default('sight'), // sight/usance_30/usance_60/usance_90/usance_120/usance_180
  lcAmount: numeric('lc_amount', { precision: 18, scale: 2 }).notNull(),
  currency: currencyEnum('currency').default('USD'),
  issuingBank: text('issuing_bank').notNull(),
  advisingBank: text('advising_bank'),
  openingDate: date('opening_date'),
  expiryDate: date('expiry_date').notNull(),
  latestShipDate: date('latest_ship_date'),
  presentationDays: integer('presentation_days').default(21), // days after BL to present docs
  portOfLoading: text('port_of_loading'),
  portOfDischarge: text('port_of_discharge'),
  incoterms: incotermsEnum('incoterms').default('CIF'),
  partialShipment: boolean('partial_shipment').default(false),
  transhipment: boolean('transhipment').default(false),
  specialTerms: text('special_terms'),
  swiftRef: text('swift_ref'), // MT700 reference
  documentsReceivedDate: date('documents_received_date'),
  scrutinyStatus: text('scrutiny_status').default('pending'), // pending/clean/discrepant
  retiredDate: date('retired_date'),
  status: lcStatusEnum('status').default('draft'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const lcAmendments = pgTable('lc_amendments', {
  id: uuid('id').primaryKey().defaultRandom(),
  lcId: uuid('lc_id').notNull(),
  amendmentNo: integer('amendment_no').notNull(),
  fieldChanged: text('field_changed').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  reason: text('reason').notNull(),
  approvedDate: date('approved_date'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const lcCharges = pgTable('lc_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  lcId: uuid('lc_id').notNull(),
  chargeType: text('charge_type').notNull(), // opening_commission/swift/handling/amendment/acceptance/retirement/discrepancy_fee/other
  description: text('description'),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').default('PKR'),
  chargedDate: date('charged_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const lcDocuments = pgTable('lc_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  lcId: uuid('lc_id').notNull(),
  documentType: text('document_type').notNull(),
  required: boolean('required').default(true),
  received: boolean('received').default(false),
  receivedDate: date('received_date'),
  discrepancy: text('discrepancy'),
  discrepancyStatus: text('discrepancy_status').default('none'), // none/pending/waived/corrected
  notes: text('notes'),
});

// ─── Customs / GD ─────────────────────────────────────────────────────────────

export const gdStatusEnum = pgEnum('gd_status', [
  'draft', 'filed',
  'green_channel', 'yellow_channel', 'red_channel',
  'query_raised', 'query_replied',
  'examination_done', 'assessment_ordered',
  'duty_paid', 'cleared', 'cancelled',
]);

export const goodsDeclarations = pgTable('goods_declarations', {
  id: uuid('id').primaryKey().defaultRandom(),
  gdNo: text('gd_no'),                              // WeBOC ref e.g. KAPE-HC-2026-0012345
  gdDate: date('gd_date'),
  gdType: text('gd_type').default('home_consumption'), // home_consumption/warehousing/transit
  shipmentId: uuid('shipment_id'),
  clearingAgentName: text('clearing_agent_name'),
  customsStation: text('customs_station'),           // KAPE/KAQE/KHI-Airport/Lahore Dry Port
  importRegNo: text('import_reg_no'),
  ntn: text('ntn'),
  strn: text('strn'),
  exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 }),  // USD→PKR at filing
  channel: text('channel'),                          // green/yellow/red (set at filing)
  // Duty totals (computed from lines)
  totalAssessableValuePkr: numeric('total_assessable_value_pkr', { precision: 18, scale: 2 }),
  totalCustomsDutyPkr: numeric('total_customs_duty_pkr', { precision: 18, scale: 2 }),
  totalSalesTaxPkr: numeric('total_sales_tax_pkr', { precision: 18, scale: 2 }),
  totalOtherDutyPkr: numeric('total_other_duty_pkr', { precision: 18, scale: 2 }),
  totalPayablePkr: numeric('total_payable_pkr', { precision: 18, scale: 2 }),
  srosApplied: text('sros_applied'),                 // comma-separated SRO numbers
  // Assessment Order
  aoNo: text('ao_no'),
  aoDate: date('ao_date'),
  // PSID / Duty Payment
  psidNo: text('psid_no'),
  psidDate: date('psid_date'),
  psidBankName: text('psid_bank_name'),
  psidAmountPkr: numeric('psid_amount_pkr', { precision: 18, scale: 2 }),
  // Examination
  examinationDate: date('examination_date'),
  examinationOfficer: text('examination_officer'),
  examinationLocation: text('examination_location'),
  examinationFindings: text('examination_findings'),  // clear/shortage/excess/mislabeled
  examinationReportNo: text('examination_report_no'),
  examinationChargesPkr: numeric('examination_charges_pkr', { precision: 15, scale: 2 }),
  // Query
  queryText: text('query_text'),
  queryRaisedDate: date('query_raised_date'),
  queryReply: text('query_reply'),
  queryRepliedDate: date('query_replied_date'),
  // Clearance
  gdClearedDate: date('gd_cleared_date'),
  status: gdStatusEnum('status').default('draft'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const gdLines = pgTable('gd_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  gdId: uuid('gd_id').notNull(),
  hsCode: text('hs_code').notNull(),
  commodityDescription: text('commodity_description').notNull(),
  countryOfOrigin: text('country_of_origin'),
  qty: numeric('qty', { precision: 15, scale: 3 }),
  uom: text('uom'),
  cifValuePkr: numeric('cif_value_pkr', { precision: 18, scale: 2 }),
  assessableValuePkr: numeric('assessable_value_pkr', { precision: 18, scale: 2 }),
  // Duty fields — % and computed PKR amounts
  customsDutyPct: numeric('customs_duty_pct', { precision: 7, scale: 4 }),
  customsDutyPkr: numeric('customs_duty_pkr', { precision: 18, scale: 2 }),
  additionalCdPct: numeric('additional_cd_pct', { precision: 7, scale: 4 }),
  additionalCdPkr: numeric('additional_cd_pkr', { precision: 18, scale: 2 }),
  regulatoryDutyPct: numeric('regulatory_duty_pct', { precision: 7, scale: 4 }),
  regulatoryDutyPkr: numeric('regulatory_duty_pkr', { precision: 18, scale: 2 }),
  salesTaxPct: numeric('sales_tax_pct', { precision: 7, scale: 4 }).default('17'),
  salesTaxPkr: numeric('sales_tax_pkr', { precision: 18, scale: 2 }),
  whtPct: numeric('wht_pct', { precision: 7, scale: 4 }),
  whtPkr: numeric('wht_pkr', { precision: 18, scale: 2 }),
  incomeTaxPct: numeric('income_tax_pct', { precision: 7, scale: 4 }),
  incomeTaxPkr: numeric('income_tax_pkr', { precision: 18, scale: 2 }),
  antiDumpingDutyPkr: numeric('anti_dumping_duty_pkr', { precision: 18, scale: 2 }),
  sroDeductionPkr: numeric('sro_deduction_pkr', { precision: 18, scale: 2 }),
  totalDutyPkr: numeric('total_duty_pkr', { precision: 18, scale: 2 }),
  sortOrder: integer('sort_order').default(0),
});

// ─── Stock Transfers ──────────────────────────────────────────────────────────

export const transferStatusEnum = pgEnum('transfer_status', ['draft', 'validated', 'done', 'cancelled']);

export const stockTransfers = pgTable('stock_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferNo: text('transfer_no').unique().notNull(),
  transferDate: date('transfer_date').notNull(),
  fromWarehouseId: uuid('from_warehouse_id').notNull(),
  fromLocationId: uuid('from_location_id'),
  toWarehouseId: uuid('to_warehouse_id').notNull(),
  toLocationId: uuid('to_location_id'),
  status: transferStatusEnum('status').default('draft'),
  reason: text('reason'),
  notes: text('notes'),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  doneAt: timestamp('done_at', { withTimezone: true }),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const stockTransferLines = pgTable('stock_transfer_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').notNull(),
  productId: uuid('product_id').notNull(),
  lotBatchNo: text('lot_batch_no'),
  requestedQty: numeric('requested_qty', { precision: 15, scale: 3 }).notNull(),
  doneQty: numeric('done_qty', { precision: 15, scale: 3 }),
  uom: uomEnum('uom'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Stock Adjustments ────────────────────────────────────────────────────────

export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  adjNo: text('adj_no').unique().notNull(),
  adjDate: date('adj_date').notNull(),
  warehouseId: uuid('warehouse_id').notNull(),
  locationId: uuid('location_id'),
  productId: uuid('product_id').notNull(),
  lotBatchNo: text('lot_batch_no'),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),  // positive or negative
  uom: text('uom'),
  reasonCode: text('reason_code').notNull(), // damage/spillage/sampling/expired/count_correction/other
  notes: text('notes'),
  approvedById: uuid('approved_by_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── GRN ──────────────────────────────────────────────────────────────────────

export const grnStatusEnum = pgEnum('grn_status', [
  'draft', 'posted', 'qc_hold', 'qc_released', 'cancelled',
]);

export const grns = pgTable('grns', {
  id: uuid('id').primaryKey().defaultRandom(),
  grnNo: text('grn_no').unique().notNull(),
  grnDate: date('grn_date').notNull(),
  shipmentId: uuid('shipment_id'),
  gdId: uuid('gd_id'),
  poId: uuid('po_id'),
  warehouseId: uuid('warehouse_id').notNull(),
  receivingLocationId: uuid('receiving_location_id'),
  vehicleNo: text('vehicle_no'),
  driverName: text('driver_name'),
  deliveryChallanNo: text('delivery_challan_no'),
  receivedById: uuid('received_by_id'),
  status: grnStatusEnum('status').default('draft'),
  notes: text('notes'),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  qcReleasedAt: timestamp('qc_released_at', { withTimezone: true }),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const grnLines = pgTable('grn_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  grnId: uuid('grn_id').notNull(),
  productId: uuid('product_id').notNull(),
  hsCode: text('hs_code'),
  orderedQty: numeric('ordered_qty', { precision: 15, scale: 3 }),
  receivedQty: numeric('received_qty', { precision: 15, scale: 3 }).notNull(),
  acceptedQty: numeric('accepted_qty', { precision: 15, scale: 3 }),  // after QC
  rejectedQty: numeric('rejected_qty', { precision: 15, scale: 3 }),
  uom: uomEnum('uom'),
  lotBatchNo: text('lot_batch_no'),
  expiryDate: date('expiry_date'),
  storageLocationId: uuid('storage_location_id'),
  qualityStatus: qualityStatusEnum('quality_status').default('accepted'),
  conditionOnReceipt: text('condition_on_receipt').default('good'), // good/damaged/wet/short
  unitWeightKg: numeric('unit_weight_kg', { precision: 10, scale: 4 }),
  totalWeightKg: numeric('total_weight_kg', { precision: 15, scale: 3 }),
  remarks: text('remarks'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Stock Ledger ─────────────────────────────────────────────────────────────

export const stockLedger = pgTable('stock_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull(),
  warehouseId: uuid('warehouse_id').notNull(),
  locationId: uuid('location_id'),
  movementType: text('movement_type').notNull(), // grn_in/sale_out/transfer_in/transfer_out/adjustment/qc_hold/qc_release/rejection
  referenceType: text('reference_type'),         // grn/sale/transfer/adjustment
  referenceId: uuid('reference_id'),
  referenceLineId: uuid('reference_line_id'),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(), // positive=in, negative=out
  uom: text('uom'),
  lotBatchNo: text('lot_batch_no'),
  expiryDate: date('expiry_date'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Landed Cost ─────────────────────────────────────────────────────────────

export const landedCostStatusEnum = pgEnum('landed_cost_status', ['draft', 'finalized']);

export const landedCosts = pgTable('landed_costs', {
  id: uuid('id').primaryKey().defaultRandom(),
  costSheetNo: text('cost_sheet_no').unique().notNull(),
  shipmentId: uuid('shipment_id').notNull(),
  gdId: uuid('gd_id'),
  lcId: uuid('lc_id'),
  grnId: uuid('grn_id'),
  status: landedCostStatusEnum('status').default('draft'),

  // Product Cost (from PO/Shipment)
  fobValueUsd: numeric('fob_value_usd', { precision: 18, scale: 4 }),
  freightUsd: numeric('freight_usd', { precision: 18, scale: 4 }),
  insuranceUsd: numeric('insurance_usd', { precision: 18, scale: 4 }),
  cifValueUsd: numeric('cif_value_usd', { precision: 18, scale: 4 }),
  exchangeRateApplied: numeric('exchange_rate_applied', { precision: 15, scale: 4 }),
  cifValuePkr: numeric('cif_value_pkr', { precision: 18, scale: 2 }),

  // Duty & Taxes (from GD)
  customsDutyPkr: numeric('customs_duty_pkr', { precision: 18, scale: 2 }).default('0'),
  additionalCdPkr: numeric('additional_cd_pkr', { precision: 18, scale: 2 }).default('0'),
  regulatoryDutyPkr: numeric('regulatory_duty_pkr', { precision: 18, scale: 2 }).default('0'),
  salesTaxAdjPkr: numeric('sales_tax_adj_pkr', { precision: 18, scale: 2 }).default('0'),
  salesTaxNonAdjPkr: numeric('sales_tax_non_adj_pkr', { precision: 18, scale: 2 }).default('0'),
  whtPkr: numeric('wht_pkr', { precision: 18, scale: 2 }).default('0'),
  incomeTaxPkr: numeric('income_tax_pkr', { precision: 18, scale: 2 }).default('0'),

  // Clearing & Forwarding
  clearingAgentFeePkr: numeric('clearing_agent_fee_pkr', { precision: 18, scale: 2 }).default('0'),
  documentationChargesPkr: numeric('documentation_charges_pkr', { precision: 18, scale: 2 }).default('0'),
  examinationChargesPkr: numeric('examination_charges_pkr', { precision: 18, scale: 2 }).default('0'),

  // Port & Terminal
  thcPkr: numeric('thc_pkr', { precision: 18, scale: 2 }).default('0'),
  wharfagePkr: numeric('wharfage_pkr', { precision: 18, scale: 2 }).default('0'),
  portTrustPkr: numeric('port_trust_pkr', { precision: 18, scale: 2 }).default('0'),
  scanningFeePkr: numeric('scanning_fee_pkr', { precision: 18, scale: 2 }).default('0'),
  demurragePkr: numeric('demurrage_pkr', { precision: 18, scale: 2 }).default('0'),
  detentionPkr: numeric('detention_pkr', { precision: 18, scale: 2 }).default('0'),

  // Bank / LC Charges (auto-summed from lc_charges)
  lcChargesPkr: numeric('lc_charges_pkr', { precision: 18, scale: 2 }).default('0'),

  // Inland Transport
  inlandFreightPkr: numeric('inland_freight_pkr', { precision: 18, scale: 2 }).default('0'),

  // Other
  otherChargesPkr: numeric('other_charges_pkr', { precision: 18, scale: 2 }).default('0'),
  otherChargesDesc: text('other_charges_desc'),

  // Totals (computed server-side)
  totalDutyTaxesPkr: numeric('total_duty_taxes_pkr', { precision: 18, scale: 2 }),
  totalLandedCostPkr: numeric('total_landed_cost_pkr', { precision: 18, scale: 2 }),
  totalQtyReceived: numeric('total_qty_received', { precision: 15, scale: 3 }),
  qtyUom: text('qty_uom'),
  landedCostPerUnitPkr: numeric('landed_cost_per_unit_pkr', { precision: 18, scale: 4 }),

  notes: text('notes'),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Finance — Vendor Bills ──────────────────────────────────────────────────

export const billStatusEnum = pgEnum('bill_status', [
  'draft', 'posted', 'partially_paid', 'paid', 'cancelled',
]);

export const vendorBills = pgTable('vendor_bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  billNo: text('bill_no').unique().notNull(),
  billDate: date('bill_date').notNull(),
  dueDate: date('due_date'),
  supplierId: uuid('supplier_id'),
  supplierName: text('supplier_name').notNull(),
  billType: text('bill_type').notNull(), // supplier_goods/clearing_agent/freight/port_charges/bank_lc/other
  // Linked consignment docs
  poId: uuid('po_id'),
  grnId: uuid('grn_id'),
  shipmentId: uuid('shipment_id'),
  lcId: uuid('lc_id'),
  // Amounts
  currency: text('currency').default('PKR'),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 4 }).default('1'),
  totalAmountPkr: numeric('total_amount_pkr', { precision: 18, scale: 2 }),
  totalPaid: numeric('total_paid', { precision: 18, scale: 2 }).default('0'),
  balanceDue: numeric('balance_due', { precision: 18, scale: 2 }),
  // Status & match
  status: billStatusEnum('status').default('draft'),
  matchStatus: text('match_status').default('unmatched'), // unmatched/matched/discrepancy
  postedAt: timestamp('posted_at', { withTimezone: true }),
  notes: text('notes'),
  supplierInvoiceNo: text('supplier_invoice_no'),
  supplierInvoiceDate: date('supplier_invoice_date'),
  // Debit note fields (null on regular bills)
  praId: uuid('pra_id'),                             // linked purchase return authorization
  linkedBillId: uuid('linked_bill_id'),              // original vendor bill this DN reduces
  debitApplicationType: text('debit_application_type'), // applied_to_bill | supplier_credit
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const vendorBillLines = pgTable('vendor_bill_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').notNull(),
  description: text('description').notNull(),
  accountCode: text('account_code'),
  quantity: numeric('quantity', { precision: 15, scale: 3 }).default('1'),
  unitPrice: numeric('unit_price', { precision: 15, scale: 4 }),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  taxPct: numeric('tax_pct', { precision: 5, scale: 2 }).default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }),
  sortOrder: integer('sort_order').default(0),
});

// ─── Finance — Payments ───────────────────────────────────────────────────────

export const paymentStatusEnum = pgEnum('payment_status', [
  'draft', 'approved', 'paid', 'cancelled',
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentNo: text('payment_no').unique().notNull(),
  paymentDate: date('payment_date').notNull(),
  paymentType: text('payment_type').notNull(), // tt/lc_settlement/local_transfer/cash/cheque
  supplierId: uuid('supplier_id'),
  supplierName: text('supplier_name'),
  billId: uuid('bill_id'),
  currency: text('currency').default('PKR'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 4 }).default('1'),
  amountPkr: numeric('amount_pkr', { precision: 18, scale: 2 }),
  bankAccountCode: text('bank_account_code'),
  bankRef: text('bank_ref'),
  bankName: text('bank_name'),
  formMNo: text('form_m_no'), // SBP Form-M for foreign payments
  status: paymentStatusEnum('status').default('draft'),
  approvedById: uuid('approved_by_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Finance — Journal Entries ────────────────────────────────────────────────

export const jeStatusEnum = pgEnum('je_status', ['draft', 'posted', 'reversed']);

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  jeNo: text('je_no').unique().notNull(),
  jeDate: date('je_date').notNull(),
  description: text('description').notNull(),
  reference: text('reference'),
  referenceType: text('reference_type'), // bill/payment/gd/grn/manual
  referenceId: uuid('reference_id'),
  status: jeStatusEnum('status').default('draft'),
  totalDebit: numeric('total_debit', { precision: 18, scale: 2 }),
  totalCredit: numeric('total_credit', { precision: 18, scale: 2 }),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const journalLines = pgTable('journal_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  jeId: uuid('je_id').notNull(),
  accountCode: text('account_code').notNull(),
  accountName: text('account_name'),
  debit: numeric('debit', { precision: 18, scale: 2 }).default('0'),
  credit: numeric('credit', { precision: 18, scale: 2 }).default('0'),
  currency: text('currency').default('PKR'),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 4 }).default('1'),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Finance — Exchange Rates ─────────────────────────────────────────────────

export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  currency: text('currency').notNull(),
  rateDate: date('rate_date').notNull(),
  rate: numeric('rate', { precision: 15, scale: 4 }).notNull(), // PKR per 1 unit
  source: text('source').default('manual'), // manual/sbp
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Dispatch Challans ───────────────────────────────────────────────────────

export const dcStatusEnum = pgEnum('dc_status', [
  'draft', 'approved', 'gate_pass_issued', 'in_transit', 'delivered', 'returned',
]);

export const dispatchChallans = pgTable('dispatch_challans', {
  id: uuid('id').primaryKey().defaultRandom(),
  dcNo: text('dc_no').unique().notNull(),
  dcDate: date('dc_date').notNull(),
  soId: uuid('so_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  deliveryAddressId: uuid('delivery_address_id'),
  warehouseId: uuid('warehouse_id'),
  vehicleNo: text('vehicle_no'),
  driverName: text('driver_name'),
  driverCnic: text('driver_cnic'),
  transportCompany: text('transport_company'),
  freightResponsibility: text('freight_responsibility').default('ex_works'), // ex_works/to_door
  freightChargesPkr: numeric('freight_charges_pkr', { precision: 15, scale: 2 }).default('0'),
  gatePassNo: text('gate_pass_no'),
  gateOutTime: timestamp('gate_out_time', { withTimezone: true }),
  estimatedArrivalDate: date('estimated_arrival_date'),
  deliveryConfirmedDate: date('delivery_confirmed_date'),
  status: dcStatusEnum('status').default('draft'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const dispatchChallanLines = pgTable('dispatch_challan_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  dcId: uuid('dc_id').notNull(),
  soLineId: uuid('so_line_id').notNull(),
  productId: uuid('product_id').notNull(),
  lotBatchNo: text('lot_batch_no'),
  expiryDate: date('expiry_date'),
  dispatchedQty: numeric('dispatched_qty', { precision: 15, scale: 3 }).notNull(),
  uom: text('uom'),
  grossWeightKg: numeric('gross_weight_kg', { precision: 12, scale: 3 }),
  netWeightKg: numeric('net_weight_kg', { precision: 12, scale: 3 }),
  packageCount: integer('package_count'),
  packageType: text('package_type'),  // bags/drums/cylinders/cartons/bulk
  weighmentSlipNo: text('weighment_slip_no'),
  qualityCertNo: text('quality_cert_no'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Sales Orders ────────────────────────────────────────────────────────────

export const soStatusEnum = pgEnum('so_status', [
  'draft', 'pending_approval', 'confirmed', 'partially_dispatched',
  'fully_dispatched', 'invoiced', 'closed', 'cancelled',
]);

export const creditCheckEnum = pgEnum('credit_check', ['pass', 'fail', 'override']);

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  soNo: text('so_no').unique().notNull(),
  soDate: date('so_date').notNull(),
  customerId: uuid('customer_id').notNull(),
  quotationId: uuid('quotation_id'),
  paymentTerms: text('payment_terms').default('net_30'),
  deliveryAddressId: uuid('delivery_address_id'),
  requestedDeliveryDate: date('requested_delivery_date'),
  promisedDeliveryDate: date('promised_delivery_date'),
  branchId: uuid('branch_id'),
  warehouseId: uuid('warehouse_id'),
  status: soStatusEnum('status').default('draft'),
  creditCheck: creditCheckEnum('credit_check'),
  outstandingBalancePkr: numeric('outstanding_balance_pkr', { precision: 18, scale: 2 }),
  creditLimitPkr: numeric('credit_limit_pkr', { precision: 18, scale: 2 }),
  approvedById: uuid('approved_by_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvalNote: text('approval_note'),
  cancellationReason: text('cancellation_reason'),
  internalNotes: text('internal_notes'),
  subtotalPkr: numeric('subtotal_pkr', { precision: 18, scale: 2 }).default('0'),
  salesTaxPkr: numeric('sales_tax_pkr', { precision: 18, scale: 2 }).default('0'),
  whtPkr: numeric('wht_pkr', { precision: 18, scale: 2 }).default('0'),
  grandTotalPkr: numeric('grand_total_pkr', { precision: 18, scale: 2 }).default('0'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesOrderLines = pgTable('sales_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  soId: uuid('so_id').notNull(),
  productId: uuid('product_id').notNull(),
  orderedQty: numeric('ordered_qty', { precision: 15, scale: 3 }).notNull(),
  uom: text('uom'),
  unitPricePkr: numeric('unit_price_pkr', { precision: 15, scale: 4 }).notNull(),
  discountPct: numeric('discount_pct', { precision: 7, scale: 4 }).default('0'),
  netUnitPricePkr: numeric('net_unit_price_pkr', { precision: 15, scale: 4 }),
  totalPkr: numeric('total_pkr', { precision: 18, scale: 2 }),
  salesTaxPct: numeric('sales_tax_pct', { precision: 7, scale: 4 }).default('17'),
  salesTaxPkr: numeric('sales_tax_pkr', { precision: 18, scale: 2 }).default('0'),
  reservedQty: numeric('reserved_qty', { precision: 15, scale: 3 }).default('0'),
  dispatchedQty: numeric('dispatched_qty', { precision: 15, scale: 3 }).default('0'),
  backorderQty: numeric('backorder_qty', { precision: 15, scale: 3 }).default('0'),
  sortOrder: integer('sort_order').default(0),
});

export const stockReservations = pgTable('stock_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  soId: uuid('so_id').notNull(),
  soLineId: uuid('so_line_id').notNull(),
  productId: uuid('product_id').notNull(),
  warehouseId: uuid('warehouse_id').notNull(),
  lotBatchNo: text('lot_batch_no'),
  expiryDate: date('expiry_date'),
  reservedQty: numeric('reserved_qty', { precision: 15, scale: 3 }).notNull(),
  releasedQty: numeric('released_qty', { precision: 15, scale: 3 }).default('0'),
  status: text('status').default('reserved'),  // reserved/partially_released/released
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Sales Inquiries ──────────────────────────────────────────────────────────

export const inquiryStatusEnum = pgEnum('inquiry_status', ['new', 'quoted', 'won', 'lost', 'cancelled']);

export const salesInquiries = pgTable('sales_inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  inquiryNo: text('inquiry_no').unique().notNull(),
  date: date('date').notNull(),
  customerId: uuid('customer_id').notNull(),
  receivedVia: text('received_via').default('phone'), // whatsapp/email/phone/visit
  requiredByDate: date('required_by_date'),
  notes: text('notes'),
  status: inquiryStatusEnum('status').default('new'),
  lossReason: text('loss_reason'),              // price/availability/quality/competitor
  linkedQuotationId: uuid('linked_quotation_id'),
  assignedToId: uuid('assigned_to_id'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesInquiryLines = pgTable('sales_inquiry_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  inquiryId: uuid('inquiry_id').notNull(),
  productId: uuid('product_id').notNull(),
  tentativeQty: numeric('tentative_qty', { precision: 15, scale: 3 }),
  uom: text('uom'),
  targetPricePkr: numeric('target_price_pkr', { precision: 15, scale: 4 }),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Sales Quotations ─────────────────────────────────────────────────────────

export const quotationStatusEnum = pgEnum('quotation_status', [
  'draft', 'sent', 'accepted', 'rejected', 'revised', 'expired', 'cancelled',
]);

export const salesQuotations = pgTable('sales_quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationNo: text('quotation_no').unique().notNull(),
  revisionNo: integer('revision_no').default(0),
  parentQuotationId: uuid('parent_quotation_id'),     // set when this is a revision
  date: date('date').notNull(),
  validUntil: date('valid_until').notNull(),
  customerId: uuid('customer_id').notNull(),
  inquiryId: uuid('inquiry_id'),
  paymentTerms: text('payment_terms').default('net_30'),
  deliveryAddressId: uuid('delivery_address_id'),
  branchId: uuid('branch_id'),
  status: quotationStatusEnum('status').default('draft'),
  rejectionReason: text('rejection_reason'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  termsConditions: text('terms_conditions'),
  internalNotes: text('internal_notes'),
  subtotalPkr: numeric('subtotal_pkr', { precision: 18, scale: 2 }).default('0'),
  salesTaxPkr: numeric('sales_tax_pkr', { precision: 18, scale: 2 }).default('0'),
  whtPkr: numeric('wht_pkr', { precision: 18, scale: 2 }).default('0'),
  grandTotalPkr: numeric('grand_total_pkr', { precision: 18, scale: 2 }).default('0'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesQuotationLines = pgTable('sales_quotation_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id').notNull(),
  productId: uuid('product_id').notNull(),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  uom: text('uom'),
  unitPricePkr: numeric('unit_price_pkr', { precision: 15, scale: 4 }).notNull(),
  discountPct: numeric('discount_pct', { precision: 7, scale: 4 }).default('0'),
  netUnitPricePkr: numeric('net_unit_price_pkr', { precision: 15, scale: 4 }),
  totalPkr: numeric('total_pkr', { precision: 18, scale: 2 }),
  salesTaxPct: numeric('sales_tax_pct', { precision: 7, scale: 4 }).default('17'),
  salesTaxPkr: numeric('sales_tax_pkr', { precision: 18, scale: 2 }).default('0'),
  landedCostRefPkr: numeric('landed_cost_ref_pkr', { precision: 15, scale: 4 }),
  marginPct: numeric('margin_pct', { precision: 7, scale: 4 }),
  sortOrder: integer('sort_order').default(0),
});

// ─── Sales Invoices ───────────────────────────────────────────────────────────

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'posted', 'sent', 'partially_paid', 'fully_paid', 'overdue', 'cancelled',
]);
export const invoiceTypeEnum = pgEnum('invoice_type', [
  'tax_invoice', 'simplified_invoice', 'credit_note', 'debit_note',
]);
export const fbrStatusEnum = pgEnum('fbr_status', [
  'pending', 'submitted', 'accepted', 'rejected', 'cancelled',
]);

export const salesInvoices = pgTable('sales_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNo: text('invoice_no').unique().notNull(),
  invoiceDate: date('invoice_date').notNull(),
  invoiceType: invoiceTypeEnum('invoice_type').default('tax_invoice'),
  dcId: uuid('dc_id'),
  soId: uuid('so_id'),
  customerId: uuid('customer_id').notNull(),
  paymentTerms: text('payment_terms').default('net_30'),
  dueDate: date('due_date'),
  status: invoiceStatusEnum('status').default('draft'),
  fbrInvoiceNo: text('fbr_invoice_no'),
  fbrQrCode: text('fbr_qr_code'),
  fbrStatus: fbrStatusEnum('fbr_status').default('pending'),
  fbrErrorCode: text('fbr_error_code'),
  subtotalPkr: numeric('subtotal_pkr', { precision: 18, scale: 2 }).default('0'),
  salesTaxPkr: numeric('sales_tax_pkr', { precision: 18, scale: 2 }).default('0'),
  whtPkr: numeric('wht_pkr', { precision: 18, scale: 2 }).default('0'),
  grandTotalPkr: numeric('grand_total_pkr', { precision: 18, scale: 2 }).default('0'),
  amountReceivedPkr: numeric('amount_received_pkr', { precision: 18, scale: 2 }).default('0'),
  balancePkr: numeric('balance_pkr', { precision: 18, scale: 2 }).default('0'),
  cancellationReason: text('cancellation_reason'),
  cancelledById: uuid('cancelled_by_id'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  internalNotes: text('internal_notes'),
  termsConditions: text('terms_conditions'),
  // Credit note fields (null on regular invoices)
  raId: uuid('ra_id'),                               // linked return authorization
  linkedInvoiceId: uuid('linked_invoice_id'),         // original invoice this CN reverses
  creditApplicationType: text('credit_application_type'), // applied_to_invoice | refund
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const salesInvoiceLines = pgTable('sales_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull(),
  dcLineId: uuid('dc_line_id'),
  productId: uuid('product_id'),
  hsCode: text('hs_code'),
  description: text('description').notNull(),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  uom: text('uom'),
  unitPricePkr: numeric('unit_price_pkr', { precision: 15, scale: 4 }).notNull(),
  discountPkr: numeric('discount_pkr', { precision: 18, scale: 2 }).default('0'),
  taxableValuePkr: numeric('taxable_value_pkr', { precision: 18, scale: 2 }),
  salesTaxPct: numeric('sales_tax_pct', { precision: 7, scale: 4 }).default('17'),
  salesTaxPkr: numeric('sales_tax_pkr', { precision: 18, scale: 2 }).default('0'),
  sortOrder: integer('sort_order').default(0),
});

export const invoicePayments = pgTable('invoice_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull(),
  paymentDate: date('payment_date').notNull(),
  amountPkr: numeric('amount_pkr', { precision: 18, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').default('bank_transfer'), // cash/cheque/bank_transfer/online
  referenceNo: text('reference_no'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Customer Receipts ────────────────────────────────────────────────────────

export const receiptStatusEnum = pgEnum('receipt_status', [
  'cleared', 'pending', 'bounced', 'cancelled',
]);

export const customerReceipts = pgTable('customer_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptNo: text('receipt_no').unique().notNull(),
  receiptDate: date('receipt_date').notNull(),
  customerId: uuid('customer_id').notNull(),
  totalAmountPkr: numeric('total_amount_pkr', { precision: 18, scale: 2 }).notNull(),
  allocatedAmountPkr: numeric('allocated_amount_pkr', { precision: 18, scale: 2 }).default('0'),
  unallocatedAmountPkr: numeric('unallocated_amount_pkr', { precision: 18, scale: 2 }).default('0'),
  paymentMethod: text('payment_method').default('bank_transfer'), // cash/cheque/bank_transfer/online/pdc
  bankName: text('bank_name'),
  branchCode: text('branch_code'),
  chequeNo: text('cheque_no'),
  chequeDueDate: date('cheque_due_date'), // for PDC
  referenceNo: text('reference_no'),      // bank TT/IBFT reference
  status: receiptStatusEnum('status').default('cleared'),
  bouncedReason: text('bounced_reason'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const receiptAllocations = pgTable('receipt_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptId: uuid('receipt_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  allocatedAmountPkr: numeric('allocated_amount_pkr', { precision: 18, scale: 2 }).notNull(),
  allocatedAt: timestamp('allocated_at', { withTimezone: true }).defaultNow(),
});

// ─── Purchase Returns & Debit Notes ──────────────────────────────────────────

export const praStatusEnum = pgEnum('pra_status', [
  'draft', 'approved', 'goods_dispatched', 'debit_issued', 'closed', 'cancelled',
]);

export const purchaseReturnAuthorizations = pgTable('purchase_return_authorizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  praNo: text('pra_no').unique().notNull(),          // PRA-YYYY-NNNN
  praDate: date('pra_date').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  poId: uuid('po_id'),                               // original purchase order
  grnId: uuid('grn_id'),                             // GRN where goods were received
  returnReason: text('return_reason').notNull(),      // quality_issue/wrong_product/damaged/short_supply/price_dispute/other
  description: text('description'),
  expectedDispatchDate: date('expected_dispatch_date'),
  returnMode: text('return_mode').default('company_ships'), // company_ships/supplier_collects
  status: praStatusEnum('status').default('draft'),
  approvedById: uuid('approved_by_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  vehicleNo: text('vehicle_no'),
  transportCompany: text('transport_company'),
  cancelledReason: text('cancelled_reason'),
  debitNoteId: uuid('debit_note_id'),                // vendor bill id once DN created
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const praLines = pgTable('pra_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  praId: uuid('pra_id').notNull(),
  grnLineId: uuid('grn_line_id'),                    // original GRN line
  productId: uuid('product_id'),
  hsCode: text('hs_code'),
  description: text('description').notNull(),
  returnQty: numeric('return_qty', { precision: 15, scale: 3 }).notNull(),
  dispatchedQty: numeric('dispatched_qty', { precision: 15, scale: 3 }),
  uom: text('uom'),
  unitPrice: numeric('unit_price', { precision: 15, scale: 4 }), // in supplier currency
  currency: text('currency').default('USD'),
  lotNo: text('lot_no'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Customer Returns & Credit Notes ─────────────────────────────────────────

export const raStatusEnum = pgEnum('ra_status', [
  'draft', 'approved', 'goods_received', 'credit_issued', 'closed', 'cancelled',
]);

export const returnAuthorizations = pgTable('return_authorizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  raNo: text('ra_no').unique().notNull(),            // RA-YYYY-NNNN
  raDate: date('ra_date').notNull(),
  customerId: uuid('customer_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),            // original invoice
  returnReason: text('return_reason').notNull(),      // quality_issue/wrong_product/excess_supply/price_dispute/other
  description: text('description'),
  expectedReturnDate: date('expected_return_date'),
  returnMode: text('return_mode').default('customer_delivers'), // customer_delivers/company_collects
  status: raStatusEnum('status').default('draft'),
  approvedById: uuid('approved_by_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  cancelledReason: text('cancelled_reason'),
  creditNoteId: uuid('credit_note_id'),              // set once CN is created
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const returnAuthorizationLines = pgTable('return_authorization_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  raId: uuid('ra_id').notNull(),
  invoiceLineId: uuid('invoice_line_id'),             // original invoice line
  productId: uuid('product_id'),
  hsCode: text('hs_code'),
  description: text('description').notNull(),
  returnQty: numeric('return_qty', { precision: 15, scale: 3 }).notNull(),
  uom: text('uom'),
  unitPricePkr: numeric('unit_price_pkr', { precision: 15, scale: 4 }),
  lotNo: text('lot_no'),
  sortOrder: integer('sort_order').default(0),
});

export const returnGrnStatusEnum = pgEnum('return_grn_status', [
  'draft', 'posted', 'cancelled',
]);

export const returnGrns = pgTable('return_grns', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnGrnNo: text('return_grn_no').unique().notNull(),  // RGRN-YYYY-NNNN
  raId: uuid('ra_id').notNull(),
  receivedDate: date('received_date').notNull(),
  warehouseId: uuid('warehouse_id'),
  locationId: uuid('location_id'),
  status: returnGrnStatusEnum('status').default('draft'),
  inspectorNotes: text('inspector_notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const returnGrnLines = pgTable('return_grn_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnGrnId: uuid('return_grn_id').notNull(),
  raLineId: uuid('ra_line_id'),
  productId: uuid('product_id'),
  description: text('description').notNull(),
  expectedQty: numeric('expected_qty', { precision: 15, scale: 3 }),
  receivedQty: numeric('received_qty', { precision: 15, scale: 3 }).notNull(),
  resaleableQty: numeric('resaleable_qty', { precision: 15, scale: 3 }).default('0'),
  damagedQty: numeric('damaged_qty', { precision: 15, scale: 3 }).default('0'),
  destroyedQty: numeric('destroyed_qty', { precision: 15, scale: 3 }).default('0'),
  qualityResult: text('quality_result').default('resaleable'), // resaleable/damaged/destroyed/mixed
  qualityNotes: text('quality_notes'),
  lotNo: text('lot_no'),
  uom: text('uom'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Proforma Invoice & Commercial Invoice ───────────────────────────────────

export const piStatusEnum = pgEnum('pi_status', [
  'draft', 'received', 'accepted', 'superseded', 'cancelled',
]);

export const proformaInvoices = pgTable('proforma_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  piNo: text('pi_no').unique().notNull(),           // supplier's reference
  piDate: date('pi_date').notNull(),
  poId: uuid('po_id').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  currency: text('currency').default('USD'),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 6 }).default('280'),
  validityDate: date('validity_date'),
  estimatedShipDate: date('estimated_ship_date'),
  portOfLoading: text('port_of_loading'),
  portOfDischarge: text('port_of_discharge'),
  incoterms: text('incoterms').default('CIF'),
  freightAmount: numeric('freight_amount', { precision: 15, scale: 2 }).default('0'),
  insuranceAmount: numeric('insurance_amount', { precision: 15, scale: 2 }).default('0'),
  totalFobValue: numeric('total_fob_value', { precision: 15, scale: 2 }).default('0'),
  totalCifValue: numeric('total_cif_value', { precision: 15, scale: 2 }).default('0'),
  totalCifPkr: numeric('total_cif_pkr', { precision: 18, scale: 2 }).default('0'),
  status: piStatusEnum('status').default('draft'),
  attachmentUrl: text('attachment_url'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const proformaInvoiceLines = pgTable('proforma_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull(),
  poLineId: uuid('po_line_id'),
  productId: uuid('product_id'),
  hsCode: text('hs_code'),
  description: text('description').notNull(),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  uom: text('uom'),
  unitPrice: numeric('unit_price', { precision: 15, scale: 4 }).notNull(),
  totalValue: numeric('total_value', { precision: 15, scale: 2 }).default('0'),
  sortOrder: integer('sort_order').default(0),
});

export const ciStatusEnum = pgEnum('ci_status', [
  'received', 'verified', 'matched', 'discrepant', 'cancelled',
]);

export const commercialInvoices = pgTable('commercial_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  ciNo: text('ci_no').unique().notNull(),           // supplier's CI reference
  ciDate: date('ci_date').notNull(),
  poId: uuid('po_id').notNull(),
  piId: uuid('pi_id'),                               // linked PI (optional)
  lcId: uuid('lc_id'),                               // linked LC (optional)
  shipmentId: uuid('shipment_id'),
  supplierId: uuid('supplier_id').notNull(),
  currency: text('currency').default('USD'),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 6 }).default('280'),
  portOfLoading: text('port_of_loading'),
  portOfDischarge: text('port_of_discharge'),
  incoterms: text('incoterms').default('CIF'),
  netWeightKg: numeric('net_weight_kg', { precision: 15, scale: 3 }),
  grossWeightKg: numeric('gross_weight_kg', { precision: 15, scale: 3 }),
  packageCount: integer('package_count'),
  marksNumbers: text('marks_numbers'),
  countryOfOrigin: text('country_of_origin'),
  freightAmount: numeric('freight_amount', { precision: 15, scale: 2 }).default('0'),
  insuranceAmount: numeric('insurance_amount', { precision: 15, scale: 2 }).default('0'),
  totalFobValue: numeric('total_fob_value', { precision: 15, scale: 2 }).default('0'),
  totalCifValue: numeric('total_cif_value', { precision: 15, scale: 2 }).default('0'),
  totalCifPkr: numeric('total_cif_pkr', { precision: 18, scale: 2 }).default('0'),
  status: ciStatusEnum('status').default('received'),
  // Matching engine results
  matchStatus: text('match_status').default('pending'),  // pending/matched/discrepant
  matchSummary: text('match_summary'),                    // JSON with variance details
  attachmentUrl: text('attachment_url'),
  notes: text('notes'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const commercialInvoiceLines = pgTable('commercial_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  ciId: uuid('ci_id').notNull(),
  poLineId: uuid('po_line_id'),
  productId: uuid('product_id'),
  hsCode: text('hs_code'),
  description: text('description').notNull(),
  qty: numeric('qty', { precision: 15, scale: 3 }).notNull(),
  uom: text('uom'),
  unitPrice: numeric('unit_price', { precision: 15, scale: 4 }).notNull(),
  totalValue: numeric('total_value', { precision: 15, scale: 2 }).default('0'),
  // Variance vs PO line
  poQty: numeric('po_qty', { precision: 15, scale: 3 }),
  poUnitPrice: numeric('po_unit_price', { precision: 15, scale: 4 }),
  qtyVariancePct: numeric('qty_variance_pct', { precision: 7, scale: 4 }),
  priceVariancePct: numeric('price_variance_pct', { precision: 7, scale: 4 }),
  varianceFlag: text('variance_flag').default('ok'), // ok/minor/violation
  sortOrder: integer('sort_order').default(0),
});

// ─── Notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  priority: text('priority').default('medium'), // critical/high/medium/info
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  referenceNo: text('reference_no'),            // human-readable ref (e.g. SHP-2026-0001)
  alertKey: text('alert_key'),                  // dedup: {type}:{refId}:{YYYY-MM-DD}
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  alertType: text('alert_type').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
