import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const planEnum = pgEnum('plan', ['starter', 'growth', 'enterprise', 'custom']);
export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended', 'trial']);

// ─── Core Platform Tables ──────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  companyName: text('company_name').notNull(),
  ntn: text('ntn'),
  strn: text('strn'),
  businessAddress: text('business_address'),
  contactPerson: text('contact_person'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  plan: planEnum('plan').notNull().default('starter'),
  status: tenantStatusEnum('status').notNull().default('active'),
  schemaName: text('schema_name').notNull(),
  suspendedReason: text('suspended_reason'),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash'),
  isSuperAdmin: boolean('is_super_admin').default(false),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const tenantUsers = pgTable('tenant_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),
  branchId: uuid('branch_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  userId: uuid('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Platform Configuration (shared across all tenants) ───────────────────────

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: planEnum('name').notNull().unique(),
  maxUsers: integer('max_users'),
  maxWarehouses: integer('max_warehouses'),
  maxConsignmentsPerMonth: integer('max_consignments_per_month'),
  storageLimitGb: integer('storage_limit_gb'),
  features: text('features'),        // JSON array of feature flags
  isActive: boolean('is_active').default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const hsCodes = pgTable('hs_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  hsCode: text('hs_code').unique().notNull(),   // 8-digit
  description: text('description').notNull(),
  cdPct: numeric('cd_pct', { precision: 5, scale: 2 }).default('0'),
  acdPct: numeric('acd_pct', { precision: 5, scale: 2 }).default('0'),
  rdPct: numeric('rd_pct', { precision: 5, scale: 2 }).default('0'),
  stPct: numeric('st_pct', { precision: 5, scale: 2 }).default('17'),
  whtPct: numeric('wht_pct', { precision: 5, scale: 2 }).default('4.5'),
  atPct: numeric('at_pct', { precision: 5, scale: 2 }).default('5.5'),
  applicableSros: text('applicable_sros'),       // comma-separated SRO numbers
  isActive: boolean('is_active').default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const ports = pgTable('ports', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),         // e.g. PKKHI
  name: text('name').notNull(),
  type: text('type').notNull(),                  // sea/air/dry/land
  city: text('city'),
  country: text('country').default('PK'),
  isActive: boolean('is_active').default(true),
});

export const shippingLines = pgTable('shipping_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  scac: text('scac'),
  freeDays: integer('free_days').default(14),
  detentionFreeDays: integer('detention_free_days').default(14),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  website: text('website'),
  isActive: boolean('is_active').default(true),
});

export const currencies = pgTable('currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),   // USD, EUR, CNY, AED, GBP, PKR
  name: text('name').notNull(),
  symbol: text('symbol'),
  rateToUsd: numeric('rate_to_usd', { precision: 18, scale: 6 }),
  rateToPkr: numeric('rate_to_pkr', { precision: 18, scale: 4 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  isActive: boolean('is_active').default(true),
});

export const countries = pgTable('countries', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),   // ISO 2-letter
  name: text('name').notNull(),
  isPreferredTradeLane: boolean('is_preferred_trade_lane').default(false),
});

// ─── Relations ─────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  tenantUsers: many(tenantUsers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  tenantUsers: many(tenantUsers),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantUsers.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [tenantUsers.userId], references: [users.id] }),
}));
