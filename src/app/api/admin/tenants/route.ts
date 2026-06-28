import { auth } from '@/lib/auth/config';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, users, tenantUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const createTenantSchema = z.object({
  companyName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  plan: z.enum(['starter', 'growth', 'enterprise', 'custom']).default('starter'),
  businessAddress: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

async function provisionTenantSchema(schemaName: string) {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    // Create schema
    await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Create all tenant tables in the new schema
    await client.unsafe(`
      SET search_path TO "${schemaName}";

      CREATE TABLE IF NOT EXISTS branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        phone TEXT,
        manager_id UUID,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS warehouses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS stock_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        warehouse_id UUID NOT NULL,
        name TEXT NOT NULL,
        location_type TEXT NOT NULL,
        parent_id UUID,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'raw_material',
        hs_code TEXT,
        uom TEXT NOT NULL DEFAULT 'KG',
        purchase_uom TEXT,
        uom_conversion NUMERIC DEFAULT 1,
        reorder_point NUMERIC DEFAULT 0,
        min_stock NUMERIC DEFAULT 0,
        max_stock NUMERIC DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        country TEXT,
        supplier_type TEXT DEFAULT 'manufacturer',
        email TEXT,
        phone TEXT,
        payment_terms TEXT DEFAULT 'lc_sight',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        customer_type TEXT DEFAULT 'manufacturer',
        ntn TEXT,
        strn TEXT,
        cnic TEXT,
        fbr_status TEXT DEFAULT 'active',
        billing_address TEXT,
        phone TEXT,
        email TEXT,
        payment_terms TEXT DEFAULT 'net_30',
        credit_limit_pkr NUMERIC DEFAULT 0,
        credit_limit_override_by TEXT DEFAULT 'finance_officer',
        sales_tax_category TEXT DEFAULT 'registered',
        wht_rate_pct NUMERIC DEFAULT 4.5,
        preferred_payment_mode TEXT DEFAULT 'cheque',
        bank_name TEXT,
        assigned_officer_id UUID,
        branch_id UUID,
        opening_balance NUMERIC DEFAULT 0,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS customer_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id) ON DELETE CASCADE,
        label TEXT,
        address TEXT NOT NULL,
        city TEXT,
        is_default BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS customer_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        designation TEXT,
        email TEXT,
        phone TEXT,
        whatsapp TEXT,
        is_primary BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS customer_pricelists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        price_tier TEXT DEFAULT 'standard',
        pricing_basis TEXT DEFAULT 'fixed',
        unit_price_pkr NUMERIC,
        markup_pct NUMERIC,
        effective_from DATE,
        effective_to DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS indents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        indent_no TEXT UNIQUE NOT NULL,
        date DATE NOT NULL,
        branch_id UUID NOT NULL,
        warehouse_id UUID,
        requester_id UUID NOT NULL,
        priority TEXT DEFAULT 'normal',
        required_by DATE,
        status TEXT DEFAULT 'draft',
        justification TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS indent_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        indent_id UUID NOT NULL REFERENCES "${schemaName}".indents(id),
        product_id UUID NOT NULL,
        qty NUMERIC NOT NULL,
        uom TEXT,
        est_price_usd NUMERIC,
        specifications TEXT,
        origin_country TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TYPE IF NOT EXISTS inquiry_status AS ENUM ('new','quoted','won','lost','cancelled');
      CREATE TYPE IF NOT EXISTS quotation_status AS ENUM ('draft','sent','accepted','rejected','revised','expired','cancelled');
      CREATE TYPE IF NOT EXISTS dc_status AS ENUM ('draft','approved','gate_pass_issued','in_transit','delivered','returned');

      CREATE TABLE IF NOT EXISTS dispatch_challans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dc_no TEXT UNIQUE NOT NULL,
        dc_date DATE NOT NULL,
        so_id UUID NOT NULL,
        customer_id UUID NOT NULL,
        delivery_address_id UUID,
        warehouse_id UUID,
        vehicle_no TEXT,
        driver_name TEXT,
        driver_cnic TEXT,
        transport_company TEXT,
        freight_responsibility TEXT DEFAULT 'ex_works',
        freight_charges_pkr NUMERIC DEFAULT 0,
        gate_pass_no TEXT,
        gate_out_time TIMESTAMPTZ,
        estimated_arrival_date DATE,
        delivery_confirmed_date DATE,
        status dc_status DEFAULT 'draft',
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dispatch_challan_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dc_id UUID NOT NULL REFERENCES "${schemaName}".dispatch_challans(id) ON DELETE CASCADE,
        so_line_id UUID NOT NULL,
        product_id UUID NOT NULL,
        lot_batch_no TEXT,
        expiry_date DATE,
        dispatched_qty NUMERIC NOT NULL,
        uom TEXT,
        gross_weight_kg NUMERIC,
        net_weight_kg NUMERIC,
        package_count INTEGER,
        package_type TEXT,
        weighment_slip_no TEXT,
        quality_cert_no TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TYPE IF NOT EXISTS so_status AS ENUM ('draft','pending_approval','confirmed','partially_dispatched','fully_dispatched','invoiced','closed','cancelled');
      CREATE TYPE IF NOT EXISTS credit_check AS ENUM ('pass','fail','override');

      CREATE TABLE IF NOT EXISTS sales_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        so_no TEXT UNIQUE NOT NULL,
        so_date DATE NOT NULL,
        customer_id UUID NOT NULL,
        quotation_id UUID,
        payment_terms TEXT DEFAULT 'net_30',
        delivery_address_id UUID,
        requested_delivery_date DATE,
        promised_delivery_date DATE,
        branch_id UUID,
        warehouse_id UUID,
        status so_status DEFAULT 'draft',
        credit_check credit_check,
        outstanding_balance_pkr NUMERIC,
        credit_limit_pkr NUMERIC,
        approved_by_id UUID,
        approved_at TIMESTAMPTZ,
        approval_note TEXT,
        cancellation_reason TEXT,
        internal_notes TEXT,
        subtotal_pkr NUMERIC DEFAULT 0,
        sales_tax_pkr NUMERIC DEFAULT 0,
        wht_pkr NUMERIC DEFAULT 0,
        grand_total_pkr NUMERIC DEFAULT 0,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_order_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        so_id UUID NOT NULL REFERENCES "${schemaName}".sales_orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        ordered_qty NUMERIC NOT NULL,
        uom TEXT,
        unit_price_pkr NUMERIC NOT NULL,
        discount_pct NUMERIC DEFAULT 0,
        net_unit_price_pkr NUMERIC,
        total_pkr NUMERIC,
        sales_tax_pct NUMERIC DEFAULT 17,
        sales_tax_pkr NUMERIC DEFAULT 0,
        reserved_qty NUMERIC DEFAULT 0,
        dispatched_qty NUMERIC DEFAULT 0,
        backorder_qty NUMERIC DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS stock_reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        so_id UUID NOT NULL,
        so_line_id UUID NOT NULL,
        product_id UUID NOT NULL,
        warehouse_id UUID NOT NULL,
        lot_batch_no TEXT,
        expiry_date DATE,
        reserved_qty NUMERIC NOT NULL,
        released_qty NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'reserved',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_inquiries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inquiry_no TEXT UNIQUE NOT NULL,
        date DATE NOT NULL,
        customer_id UUID NOT NULL,
        received_via TEXT DEFAULT 'phone',
        required_by_date DATE,
        notes TEXT,
        status inquiry_status DEFAULT 'new',
        loss_reason TEXT,
        linked_quotation_id UUID,
        assigned_to_id UUID,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_inquiry_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inquiry_id UUID NOT NULL REFERENCES "${schemaName}".sales_inquiries(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        tentative_qty NUMERIC,
        uom TEXT,
        target_price_pkr NUMERIC,
        notes TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sales_quotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_no TEXT UNIQUE NOT NULL,
        revision_no INTEGER DEFAULT 0,
        parent_quotation_id UUID,
        date DATE NOT NULL,
        valid_until DATE NOT NULL,
        customer_id UUID NOT NULL,
        inquiry_id UUID,
        payment_terms TEXT DEFAULT 'net_30',
        delivery_address_id UUID,
        branch_id UUID,
        status quotation_status DEFAULT 'draft',
        rejection_reason TEXT,
        sent_at TIMESTAMPTZ,
        accepted_at TIMESTAMPTZ,
        terms_conditions TEXT,
        internal_notes TEXT,
        subtotal_pkr NUMERIC DEFAULT 0,
        sales_tax_pkr NUMERIC DEFAULT 0,
        wht_pkr NUMERIC DEFAULT 0,
        grand_total_pkr NUMERIC DEFAULT 0,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_quotation_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID NOT NULL REFERENCES "${schemaName}".sales_quotations(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        qty NUMERIC NOT NULL,
        uom TEXT,
        unit_price_pkr NUMERIC NOT NULL,
        discount_pct NUMERIC DEFAULT 0,
        net_unit_price_pkr NUMERIC,
        total_pkr NUMERIC,
        sales_tax_pct NUMERIC DEFAULT 17,
        sales_tax_pkr NUMERIC DEFAULT 0,
        landed_cost_ref_pkr NUMERIC,
        margin_pct NUMERIC,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TYPE IF NOT EXISTS invoice_status AS ENUM ('draft','posted','sent','partially_paid','fully_paid','overdue','cancelled');
      CREATE TYPE IF NOT EXISTS invoice_type AS ENUM ('tax_invoice','simplified_invoice','credit_note','debit_note');
      CREATE TYPE IF NOT EXISTS fbr_status AS ENUM ('pending','submitted','accepted','rejected','cancelled');

      CREATE TABLE IF NOT EXISTS sales_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_no TEXT UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        invoice_type invoice_type DEFAULT 'tax_invoice',
        dc_id UUID,
        so_id UUID,
        customer_id UUID NOT NULL,
        payment_terms TEXT DEFAULT 'net_30',
        due_date DATE,
        status invoice_status DEFAULT 'draft',
        fbr_invoice_no TEXT,
        fbr_qr_code TEXT,
        fbr_status fbr_status DEFAULT 'pending',
        fbr_error_code TEXT,
        subtotal_pkr NUMERIC DEFAULT 0,
        sales_tax_pkr NUMERIC DEFAULT 0,
        wht_pkr NUMERIC DEFAULT 0,
        grand_total_pkr NUMERIC DEFAULT 0,
        amount_received_pkr NUMERIC DEFAULT 0,
        balance_pkr NUMERIC DEFAULT 0,
        cancellation_reason TEXT,
        cancelled_by_id UUID,
        cancelled_at TIMESTAMPTZ,
        posted_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        internal_notes TEXT,
        terms_conditions TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_invoice_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES "${schemaName}".sales_invoices(id) ON DELETE CASCADE,
        dc_line_id UUID,
        product_id UUID,
        hs_code TEXT,
        description TEXT NOT NULL,
        qty NUMERIC NOT NULL,
        uom TEXT,
        unit_price_pkr NUMERIC NOT NULL,
        discount_pkr NUMERIC DEFAULT 0,
        taxable_value_pkr NUMERIC,
        sales_tax_pct NUMERIC DEFAULT 17,
        sales_tax_pkr NUMERIC DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS invoice_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES "${schemaName}".sales_invoices(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        amount_pkr NUMERIC NOT NULL,
        payment_method TEXT DEFAULT 'bank_transfer',
        reference_no TEXT,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TYPE IF NOT EXISTS receipt_status AS ENUM ('cleared','pending','bounced','cancelled');

      CREATE TABLE IF NOT EXISTS customer_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_no TEXT UNIQUE NOT NULL,
        receipt_date DATE NOT NULL,
        customer_id UUID NOT NULL,
        total_amount_pkr NUMERIC NOT NULL,
        allocated_amount_pkr NUMERIC DEFAULT 0,
        unallocated_amount_pkr NUMERIC DEFAULT 0,
        payment_method TEXT DEFAULT 'bank_transfer',
        bank_name TEXT,
        branch_code TEXT,
        cheque_no TEXT,
        cheque_due_date DATE,
        reference_no TEXT,
        status receipt_status DEFAULT 'cleared',
        bounced_reason TEXT,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS receipt_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_id UUID NOT NULL REFERENCES "${schemaName}".customer_receipts(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES "${schemaName}".sales_invoices(id) ON DELETE CASCADE,
        allocated_amount_pkr NUMERIC NOT NULL,
        allocated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TYPE IF NOT EXISTS pra_status AS ENUM ('draft','approved','goods_dispatched','debit_issued','closed','cancelled');

      CREATE TABLE IF NOT EXISTS purchase_return_authorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pra_no TEXT UNIQUE NOT NULL,
        pra_date DATE NOT NULL,
        supplier_id UUID NOT NULL,
        po_id UUID,
        grn_id UUID,
        return_reason TEXT NOT NULL,
        description TEXT,
        expected_dispatch_date DATE,
        return_mode TEXT DEFAULT 'company_ships',
        status pra_status DEFAULT 'draft',
        approved_by_id UUID,
        approved_at TIMESTAMPTZ,
        dispatched_at TIMESTAMPTZ,
        vehicle_no TEXT,
        transport_company TEXT,
        cancelled_reason TEXT,
        debit_note_id UUID,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS pra_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pra_id UUID NOT NULL REFERENCES "${schemaName}".purchase_return_authorizations(id) ON DELETE CASCADE,
        grn_line_id UUID,
        product_id UUID,
        hs_code TEXT,
        description TEXT NOT NULL,
        return_qty NUMERIC NOT NULL,
        dispatched_qty NUMERIC,
        uom TEXT,
        unit_price NUMERIC,
        currency TEXT DEFAULT 'USD',
        lot_no TEXT,
        sort_order INTEGER DEFAULT 0
      );

      ALTER TABLE IF EXISTS "${schemaName}".vendor_bills
        ADD COLUMN IF NOT EXISTS pra_id UUID,
        ADD COLUMN IF NOT EXISTS linked_bill_id UUID,
        ADD COLUMN IF NOT EXISTS debit_application_type TEXT;

      CREATE TYPE IF NOT EXISTS ra_status AS ENUM ('draft','approved','goods_received','credit_issued','closed','cancelled');

      CREATE TABLE IF NOT EXISTS return_authorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ra_no TEXT UNIQUE NOT NULL,
        ra_date DATE NOT NULL,
        customer_id UUID NOT NULL,
        invoice_id UUID NOT NULL REFERENCES "${schemaName}".sales_invoices(id),
        return_reason TEXT NOT NULL,
        description TEXT,
        expected_return_date DATE,
        return_mode TEXT DEFAULT 'customer_delivers',
        status ra_status DEFAULT 'draft',
        approved_by_id UUID,
        approved_at TIMESTAMPTZ,
        cancelled_reason TEXT,
        credit_note_id UUID,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS return_authorization_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ra_id UUID NOT NULL REFERENCES "${schemaName}".return_authorizations(id) ON DELETE CASCADE,
        invoice_line_id UUID,
        product_id UUID,
        hs_code TEXT,
        description TEXT NOT NULL,
        return_qty NUMERIC NOT NULL,
        uom TEXT,
        unit_price_pkr NUMERIC,
        lot_no TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TYPE IF NOT EXISTS return_grn_status AS ENUM ('draft','posted','cancelled');

      CREATE TABLE IF NOT EXISTS return_grns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        return_grn_no TEXT UNIQUE NOT NULL,
        ra_id UUID NOT NULL REFERENCES "${schemaName}".return_authorizations(id),
        received_date DATE NOT NULL,
        warehouse_id UUID,
        location_id UUID,
        status return_grn_status DEFAULT 'draft',
        inspector_notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS return_grn_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        return_grn_id UUID NOT NULL REFERENCES "${schemaName}".return_grns(id) ON DELETE CASCADE,
        ra_line_id UUID,
        product_id UUID,
        description TEXT NOT NULL,
        expected_qty NUMERIC,
        received_qty NUMERIC NOT NULL,
        resaleable_qty NUMERIC DEFAULT 0,
        damaged_qty NUMERIC DEFAULT 0,
        destroyed_qty NUMERIC DEFAULT 0,
        quality_result TEXT DEFAULT 'resaleable',
        quality_notes TEXT,
        lot_no TEXT,
        uom TEXT,
        sort_order INTEGER DEFAULT 0
      );

      ALTER TABLE IF EXISTS "${schemaName}".sales_invoices
        ADD COLUMN IF NOT EXISTS ra_id UUID,
        ADD COLUMN IF NOT EXISTS linked_invoice_id UUID,
        ADD COLUMN IF NOT EXISTS credit_application_type TEXT;

      CREATE TYPE IF NOT EXISTS pi_status AS ENUM ('draft','received','accepted','superseded','cancelled');

      CREATE TABLE IF NOT EXISTS proforma_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pi_no TEXT UNIQUE NOT NULL,
        pi_date DATE NOT NULL,
        po_id UUID NOT NULL,
        supplier_id UUID NOT NULL,
        currency TEXT DEFAULT 'USD',
        exchange_rate NUMERIC DEFAULT 280,
        validity_date DATE,
        estimated_ship_date DATE,
        port_of_loading TEXT,
        port_of_discharge TEXT,
        incoterms TEXT DEFAULT 'CIF',
        freight_amount NUMERIC DEFAULT 0,
        insurance_amount NUMERIC DEFAULT 0,
        total_fob_value NUMERIC DEFAULT 0,
        total_cif_value NUMERIC DEFAULT 0,
        total_cif_pkr NUMERIC DEFAULT 0,
        status pi_status DEFAULT 'draft',
        attachment_url TEXT,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS proforma_invoice_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pi_id UUID NOT NULL REFERENCES "${schemaName}".proforma_invoices(id) ON DELETE CASCADE,
        po_line_id UUID,
        product_id UUID,
        hs_code TEXT,
        description TEXT NOT NULL,
        qty NUMERIC NOT NULL,
        uom TEXT,
        unit_price NUMERIC NOT NULL,
        total_value NUMERIC DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TYPE IF NOT EXISTS ci_status AS ENUM ('received','verified','matched','discrepant','cancelled');

      CREATE TABLE IF NOT EXISTS commercial_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ci_no TEXT UNIQUE NOT NULL,
        ci_date DATE NOT NULL,
        po_id UUID NOT NULL,
        pi_id UUID REFERENCES "${schemaName}".proforma_invoices(id),
        lc_id UUID,
        shipment_id UUID,
        supplier_id UUID NOT NULL,
        currency TEXT DEFAULT 'USD',
        exchange_rate NUMERIC DEFAULT 280,
        port_of_loading TEXT,
        port_of_discharge TEXT,
        incoterms TEXT DEFAULT 'CIF',
        net_weight_kg NUMERIC,
        gross_weight_kg NUMERIC,
        package_count INTEGER,
        marks_numbers TEXT,
        country_of_origin TEXT,
        freight_amount NUMERIC DEFAULT 0,
        insurance_amount NUMERIC DEFAULT 0,
        total_fob_value NUMERIC DEFAULT 0,
        total_cif_value NUMERIC DEFAULT 0,
        total_cif_pkr NUMERIC DEFAULT 0,
        status ci_status DEFAULT 'received',
        match_status TEXT DEFAULT 'pending',
        match_summary TEXT,
        attachment_url TEXT,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS commercial_invoice_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ci_id UUID NOT NULL REFERENCES "${schemaName}".commercial_invoices(id) ON DELETE CASCADE,
        po_line_id UUID,
        product_id UUID,
        hs_code TEXT,
        description TEXT NOT NULL,
        qty NUMERIC NOT NULL,
        uom TEXT,
        unit_price NUMERIC NOT NULL,
        total_value NUMERIC DEFAULT 0,
        po_qty NUMERIC,
        po_unit_price NUMERIC,
        qty_variance_pct NUMERIC,
        price_variance_pct NUMERIC,
        variance_flag TEXT DEFAULT 'ok',
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        priority TEXT DEFAULT 'medium',
        reference_type TEXT,
        reference_id UUID,
        reference_no TEXT,
        alert_key TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        alert_type TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (user_id, alert_type)
      );

      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        parent_code TEXT,
        is_group BOOLEAN DEFAULT false,
        currency TEXT DEFAULT 'PKR',
        opening_balance NUMERIC DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_system BOOLEAN DEFAULT false,
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS approval_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module TEXT NOT NULL,
        name TEXT NOT NULL,
        condition_field TEXT,
        condition_operator TEXT,
        condition_value TEXT,
        approver_role TEXT NOT NULL,
        approver_user_id UUID,
        sequence INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tenant_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TYPE IF NOT EXISTS lc_status AS ENUM (
        'draft','applied','opened','documents_presented',
        'under_scrutiny','accepted','retired','expired','cancelled'
      );

      CREATE TABLE IF NOT EXISTS letter_of_credits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lc_no TEXT UNIQUE NOT NULL,
        po_id UUID,
        supplier_id UUID NOT NULL,
        lc_type TEXT DEFAULT 'sight',
        lc_amount NUMERIC NOT NULL,
        currency TEXT DEFAULT 'USD',
        issuing_bank TEXT NOT NULL,
        advising_bank TEXT,
        opening_date DATE,
        expiry_date DATE NOT NULL,
        latest_ship_date DATE,
        presentation_days INTEGER DEFAULT 21,
        port_of_loading TEXT,
        port_of_discharge TEXT,
        incoterms TEXT DEFAULT 'CIF',
        partial_shipment BOOLEAN DEFAULT false,
        transhipment BOOLEAN DEFAULT false,
        special_terms TEXT,
        swift_ref TEXT,
        documents_received_date DATE,
        scrutiny_status TEXT DEFAULT 'pending',
        retired_date DATE,
        status lc_status DEFAULT 'draft',
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lc_amendments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lc_id UUID NOT NULL REFERENCES "${schemaName}".letter_of_credits(id),
        amendment_no INTEGER NOT NULL,
        field_changed TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT NOT NULL,
        approved_date DATE,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lc_charges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lc_id UUID NOT NULL REFERENCES "${schemaName}".letter_of_credits(id),
        charge_type TEXT NOT NULL,
        description TEXT,
        amount NUMERIC NOT NULL,
        currency TEXT DEFAULT 'PKR',
        charged_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lc_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lc_id UUID NOT NULL REFERENCES "${schemaName}".letter_of_credits(id),
        document_type TEXT NOT NULL,
        required BOOLEAN DEFAULT true,
        received BOOLEAN DEFAULT false,
        received_date DATE,
        discrepancy TEXT,
        discrepancy_status TEXT DEFAULT 'none',
        notes TEXT
      );

      CREATE TYPE IF NOT EXISTS shipment_status AS ENUM (
        'draft','booked','sailing','arrived','do_released','customs_cleared','grn_done','cancelled'
      );

      CREATE TABLE IF NOT EXISTS shipments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shipment_no TEXT UNIQUE NOT NULL,
        po_id UUID,
        lc_id UUID,
        mode TEXT DEFAULT 'sea',
        vessel_name TEXT,
        voyage_no TEXT,
        shipping_line_id UUID,
        shipping_line_name TEXT,
        freight_forwarder_id UUID,
        freight_forwarder_name TEXT,
        bl_no TEXT,
        bl_date DATE,
        bl_type TEXT DEFAULT 'original',
        port_of_loading TEXT,
        port_of_discharge TEXT,
        etd DATE,
        atd DATE,
        eta DATE,
        ata DATE,
        freight_amount NUMERIC,
        freight_currency TEXT DEFAULT 'USD',
        freight_payment TEXT DEFAULT 'prepaid',
        freight_invoice_no TEXT,
        freight_invoice_date DATE,
        freight_paid_date DATE,
        package_count INTEGER,
        gross_weight_kg NUMERIC,
        net_weight_kg NUMERIC,
        volume_cbm NUMERIC,
        do_no TEXT,
        do_released_date DATE,
        bl_received_at_bank BOOLEAN DEFAULT false,
        bl_received_date DATE,
        docs_released_by_bank BOOLEAN DEFAULT false,
        docs_released_date DATE,
        docs_sent_to_agent BOOLEAN DEFAULT false,
        docs_sent_date DATE,
        courier_tracking_no TEXT,
        status shipment_status DEFAULT 'draft',
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS shipment_containers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shipment_id UUID NOT NULL REFERENCES "${schemaName}".shipments(id),
        container_no TEXT NOT NULL,
        seal_no TEXT,
        container_type TEXT DEFAULT '20GP',
        port_free_days INTEGER DEFAULT 7,
        detention_free_days INTEGER DEFAULT 7,
        demurrage_rate_per_day NUMERIC,
        demurrage_currency TEXT DEFAULT 'USD',
        port_arrival_date DATE,
        port_clearance_date DATE,
        empty_return_date DATE,
        demurrage_invoice_no TEXT,
        demurrage_paid_amount NUMERIC
      );

      CREATE TYPE IF NOT EXISTS grn_status AS ENUM (
        'draft','posted','qc_hold','qc_released','cancelled'
      );

      CREATE TABLE IF NOT EXISTS grns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        grn_no TEXT UNIQUE NOT NULL,
        grn_date DATE NOT NULL,
        shipment_id UUID,
        gd_id UUID,
        po_id UUID,
        warehouse_id UUID NOT NULL,
        receiving_location_id UUID,
        vehicle_no TEXT,
        driver_name TEXT,
        delivery_challan_no TEXT,
        received_by_id UUID,
        status grn_status DEFAULT 'draft',
        notes TEXT,
        posted_at TIMESTAMPTZ,
        qc_released_at TIMESTAMPTZ,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS grn_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        grn_id UUID NOT NULL REFERENCES "${schemaName}".grns(id),
        product_id UUID NOT NULL,
        hs_code TEXT,
        ordered_qty NUMERIC,
        received_qty NUMERIC NOT NULL,
        accepted_qty NUMERIC,
        rejected_qty NUMERIC,
        uom TEXT,
        lot_batch_no TEXT,
        expiry_date DATE,
        storage_location_id UUID,
        quality_status TEXT DEFAULT 'accepted',
        condition_on_receipt TEXT DEFAULT 'good',
        unit_weight_kg NUMERIC,
        total_weight_kg NUMERIC,
        remarks TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS stock_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL,
        warehouse_id UUID NOT NULL,
        location_id UUID,
        movement_type TEXT NOT NULL,
        reference_type TEXT,
        reference_id UUID,
        reference_line_id UUID,
        qty NUMERIC NOT NULL,
        uom TEXT,
        lot_batch_no TEXT,
        expiry_date DATE,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TYPE IF NOT EXISTS gd_status AS ENUM (
        'draft','filed','green_channel','yellow_channel','red_channel',
        'query_raised','query_replied','examination_done','assessment_ordered',
        'duty_paid','cleared','cancelled'
      );

      CREATE TABLE IF NOT EXISTS goods_declarations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gd_no TEXT,
        gd_date DATE,
        gd_type TEXT DEFAULT 'home_consumption',
        shipment_id UUID,
        clearing_agent_name TEXT,
        customs_station TEXT,
        import_reg_no TEXT,
        ntn TEXT,
        strn TEXT,
        exchange_rate NUMERIC,
        channel TEXT,
        total_assessable_value_pkr NUMERIC,
        total_customs_duty_pkr NUMERIC,
        total_sales_tax_pkr NUMERIC,
        total_other_duty_pkr NUMERIC,
        total_payable_pkr NUMERIC,
        sros_applied TEXT,
        ao_no TEXT,
        ao_date DATE,
        psid_no TEXT,
        psid_date DATE,
        psid_bank_name TEXT,
        psid_amount_pkr NUMERIC,
        examination_date DATE,
        examination_officer TEXT,
        examination_location TEXT,
        examination_findings TEXT,
        examination_report_no TEXT,
        examination_charges_pkr NUMERIC,
        query_text TEXT,
        query_raised_date DATE,
        query_reply TEXT,
        query_replied_date DATE,
        gd_cleared_date DATE,
        status gd_status DEFAULT 'draft',
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS gd_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gd_id UUID NOT NULL REFERENCES "${schemaName}".goods_declarations(id),
        hs_code TEXT NOT NULL,
        commodity_description TEXT NOT NULL,
        country_of_origin TEXT,
        qty NUMERIC,
        uom TEXT,
        cif_value_pkr NUMERIC,
        assessable_value_pkr NUMERIC,
        customs_duty_pct NUMERIC,
        customs_duty_pkr NUMERIC,
        additional_cd_pct NUMERIC,
        additional_cd_pkr NUMERIC,
        regulatory_duty_pct NUMERIC,
        regulatory_duty_pkr NUMERIC,
        sales_tax_pct NUMERIC DEFAULT 17,
        sales_tax_pkr NUMERIC,
        wht_pct NUMERIC,
        wht_pkr NUMERIC,
        income_tax_pct NUMERIC,
        income_tax_pkr NUMERIC,
        anti_dumping_duty_pkr NUMERIC,
        sro_deduction_pkr NUMERIC,
        total_duty_pkr NUMERIC,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TYPE IF NOT EXISTS landed_cost_status AS ENUM ('draft','finalized');

      CREATE TABLE IF NOT EXISTS landed_costs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cost_sheet_no TEXT UNIQUE NOT NULL,
        shipment_id UUID NOT NULL,
        gd_id UUID,
        lc_id UUID,
        grn_id UUID,
        status landed_cost_status DEFAULT 'draft',
        fob_value_usd NUMERIC,
        freight_usd NUMERIC,
        insurance_usd NUMERIC,
        cif_value_usd NUMERIC,
        exchange_rate_applied NUMERIC,
        cif_value_pkr NUMERIC,
        customs_duty_pkr NUMERIC DEFAULT 0,
        additional_cd_pkr NUMERIC DEFAULT 0,
        regulatory_duty_pkr NUMERIC DEFAULT 0,
        sales_tax_adj_pkr NUMERIC DEFAULT 0,
        sales_tax_non_adj_pkr NUMERIC DEFAULT 0,
        wht_pkr NUMERIC DEFAULT 0,
        income_tax_pkr NUMERIC DEFAULT 0,
        clearing_agent_fee_pkr NUMERIC DEFAULT 0,
        documentation_charges_pkr NUMERIC DEFAULT 0,
        examination_charges_pkr NUMERIC DEFAULT 0,
        thc_pkr NUMERIC DEFAULT 0,
        wharfage_pkr NUMERIC DEFAULT 0,
        port_trust_pkr NUMERIC DEFAULT 0,
        scanning_fee_pkr NUMERIC DEFAULT 0,
        demurrage_pkr NUMERIC DEFAULT 0,
        detention_pkr NUMERIC DEFAULT 0,
        lc_charges_pkr NUMERIC DEFAULT 0,
        inland_freight_pkr NUMERIC DEFAULT 0,
        other_charges_pkr NUMERIC DEFAULT 0,
        other_charges_desc TEXT,
        total_duty_taxes_pkr NUMERIC,
        total_landed_cost_pkr NUMERIC,
        total_qty_received NUMERIC,
        qty_uom TEXT,
        landed_cost_per_unit_pkr NUMERIC,
        notes TEXT,
        finalized_at TIMESTAMPTZ,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TYPE IF NOT EXISTS transfer_status AS ENUM ('draft','validated','done','cancelled');

      CREATE TABLE IF NOT EXISTS stock_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transfer_no TEXT UNIQUE NOT NULL,
        transfer_date DATE NOT NULL,
        from_warehouse_id UUID NOT NULL,
        from_location_id UUID,
        to_warehouse_id UUID NOT NULL,
        to_location_id UUID,
        status transfer_status DEFAULT 'draft',
        reason TEXT,
        notes TEXT,
        validated_at TIMESTAMPTZ,
        done_at TIMESTAMPTZ,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS stock_transfer_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transfer_id UUID NOT NULL REFERENCES "${schemaName}".stock_transfers(id),
        product_id UUID NOT NULL,
        lot_batch_no TEXT,
        requested_qty NUMERIC NOT NULL,
        done_qty NUMERIC,
        uom TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        adj_no TEXT UNIQUE NOT NULL,
        adj_date DATE NOT NULL,
        warehouse_id UUID NOT NULL,
        location_id UUID,
        product_id UUID NOT NULL,
        lot_batch_no TEXT,
        qty NUMERIC NOT NULL,
        uom TEXT,
        reason_code TEXT NOT NULL,
        notes TEXT,
        approved_by_id UUID,
        approved_at TIMESTAMPTZ,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TYPE IF NOT EXISTS bill_status AS ENUM ('draft','posted','partially_paid','paid','cancelled');

      CREATE TABLE IF NOT EXISTS vendor_bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_no TEXT UNIQUE NOT NULL,
        bill_date DATE NOT NULL,
        due_date DATE,
        supplier_id UUID,
        supplier_name TEXT NOT NULL,
        bill_type TEXT NOT NULL,
        po_id UUID,
        grn_id UUID,
        shipment_id UUID,
        lc_id UUID,
        currency TEXT DEFAULT 'PKR',
        subtotal NUMERIC DEFAULT 0,
        tax_amount NUMERIC DEFAULT 0,
        total_amount NUMERIC NOT NULL,
        exchange_rate NUMERIC DEFAULT 1,
        total_amount_pkr NUMERIC,
        total_paid NUMERIC DEFAULT 0,
        balance_due NUMERIC,
        status bill_status DEFAULT 'draft',
        match_status TEXT DEFAULT 'unmatched',
        posted_at TIMESTAMPTZ,
        notes TEXT,
        supplier_invoice_no TEXT,
        supplier_invoice_date DATE,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS vendor_bill_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_id UUID NOT NULL REFERENCES "${schemaName}".vendor_bills(id),
        description TEXT NOT NULL,
        account_code TEXT,
        quantity NUMERIC DEFAULT 1,
        unit_price NUMERIC,
        amount NUMERIC NOT NULL,
        tax_pct NUMERIC DEFAULT 0,
        tax_amount NUMERIC DEFAULT 0,
        total_amount NUMERIC,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TYPE IF NOT EXISTS payment_status AS ENUM ('draft','approved','paid','cancelled');

      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_no TEXT UNIQUE NOT NULL,
        payment_date DATE NOT NULL,
        payment_type TEXT NOT NULL,
        supplier_id UUID,
        supplier_name TEXT,
        bill_id UUID,
        currency TEXT DEFAULT 'PKR',
        amount NUMERIC NOT NULL,
        exchange_rate NUMERIC DEFAULT 1,
        amount_pkr NUMERIC,
        bank_account_code TEXT,
        bank_ref TEXT,
        bank_name TEXT,
        form_m_no TEXT,
        status payment_status DEFAULT 'draft',
        approved_by_id UUID,
        approved_at TIMESTAMPTZ,
        notes TEXT,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TYPE IF NOT EXISTS je_status AS ENUM ('draft','posted','reversed');

      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        je_no TEXT UNIQUE NOT NULL,
        je_date DATE NOT NULL,
        description TEXT NOT NULL,
        reference TEXT,
        reference_type TEXT,
        reference_id UUID,
        status je_status DEFAULT 'draft',
        total_debit NUMERIC,
        total_credit NUMERIC,
        posted_at TIMESTAMPTZ,
        reversed_at TIMESTAMPTZ,
        created_by_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS journal_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        je_id UUID NOT NULL REFERENCES "${schemaName}".journal_entries(id),
        account_code TEXT NOT NULL,
        account_name TEXT,
        debit NUMERIC DEFAULT 0,
        credit NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'PKR',
        exchange_rate NUMERIC DEFAULT 1,
        description TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS exchange_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        currency TEXT NOT NULL,
        rate_date DATE NOT NULL,
        rate NUMERIC NOT NULL,
        source TEXT DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- Pre-seed Pakistan Chart of Accounts
      INSERT INTO "${schemaName}".chart_of_accounts (code, name, account_type, is_group, is_system, sort_order)
      VALUES
        ('1000', 'Assets', 'asset', true, true, 10),
        ('1100', 'Cash & Bank', 'asset', true, true, 11),
        ('1101', 'Cash in Hand', 'asset', false, true, 12),
        ('1102', 'Bank — Current Account', 'asset', false, true, 13),
        ('1200', 'Receivables', 'asset', true, true, 20),
        ('1201', 'Trade Debtors', 'asset', false, true, 21),
        ('1202', 'Advance to Suppliers', 'asset', false, true, 22),
        ('1300', 'Inventory', 'asset', true, true, 30),
        ('1301', 'Raw Material Stock', 'asset', false, true, 31),
        ('1302', 'Goods In Transit', 'asset', false, true, 32),
        ('1400', 'Prepayments & Deposits', 'asset', true, false, 40),
        ('1401', 'Prepaid Import Duties', 'asset', false, false, 41),
        ('1402', 'Security Deposits', 'asset', false, false, 42),
        ('1500', 'Fixed Assets', 'asset', true, false, 50),
        ('1501', 'Plant & Machinery', 'asset', false, false, 51),
        ('1502', 'Furniture & Fixtures', 'asset', false, false, 52),
        ('2000', 'Liabilities', 'liability', true, true, 100),
        ('2100', 'Payables', 'liability', true, true, 101),
        ('2101', 'Trade Creditors', 'liability', false, true, 102),
        ('2102', 'LC Payable', 'liability', false, true, 103),
        ('2200', 'Tax Liabilities', 'liability', true, true, 110),
        ('2201', 'Sales Tax Payable (FBR)', 'liability', false, true, 111),
        ('2202', 'Income Tax Payable (WHT)', 'liability', false, true, 112),
        ('2203', 'Additional Customs Duty', 'liability', false, false, 113),
        ('2300', 'Other Liabilities', 'liability', true, false, 120),
        ('3000', 'Equity', 'equity', true, true, 200),
        ('3100', 'Share Capital', 'equity', false, true, 201),
        ('3200', 'Retained Earnings', 'equity', false, true, 202),
        ('4000', 'Revenue', 'revenue', true, true, 300),
        ('4100', 'Sales Revenue', 'revenue', false, true, 301),
        ('4200', 'Other Income', 'revenue', false, false, 302),
        ('5000', 'Cost of Goods Sold', 'cogs', true, true, 400),
        ('5100', 'Raw Material Cost', 'cogs', false, true, 401),
        ('5200', 'Import Duties & Customs', 'cogs', false, true, 402),
        ('5201', 'Customs Duty (CD)', 'cogs', false, true, 403),
        ('5202', 'Additional Customs Duty (ACD)', 'cogs', false, true, 404),
        ('5203', 'Regulatory Duty (RD)', 'cogs', false, false, 405),
        ('5300', 'Freight & Clearing', 'cogs', false, true, 410),
        ('5301', 'Sea Freight', 'cogs', false, true, 411),
        ('5302', 'Clearing Charges', 'cogs', false, true, 412),
        ('5303', 'Port Charges & THC', 'cogs', false, true, 413),
        ('5304', 'Demurrage & Detention', 'cogs', false, false, 414),
        ('5400', 'Insurance', 'cogs', false, true, 420),
        ('6000', 'Operating Expenses', 'expense', true, true, 500),
        ('6100', 'Administrative Expenses', 'expense', false, true, 501),
        ('6200', 'Selling Expenses', 'expense', false, false, 502),
        ('6300', 'Finance Costs', 'expense', true, false, 510),
        ('6301', 'Bank Charges', 'expense', false, false, 511),
        ('6302', 'LC Commission & Charges', 'expense', false, false, 512)
      ON CONFLICT (code) DO NOTHING;
    `);
  } finally {
    await client.end();
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allTenants = await db.select().from(tenants);
  return NextResponse.json(allTenants);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { adminEmail, adminPassword, adminName, slug, ...tenantData } = parsed.data;

  // Check slug uniqueness
  const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
  }

  const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

  // 1. Provision the tenant schema
  await provisionTenantSchema(schemaName);

  // 2. Create tenant record
  const [tenant] = await db.insert(tenants).values({
    slug,
    companyName: tenantData.companyName,
    ntn: tenantData.ntn,
    strn: tenantData.strn,
    plan: tenantData.plan,
    businessAddress: tenantData.businessAddress,
    contactPerson: tenantData.contactPerson,
    contactEmail: tenantData.contactEmail || undefined,
    contactPhone: tenantData.contactPhone,
    schemaName,
    status: 'active',
  }).returning();

  // 3. Create or find admin user
  let [user] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!user) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    [user] = await db.insert(users).values({
      email: adminEmail,
      name: adminName,
      passwordHash,
    }).returning();
  }

  // 4. Link user to tenant as tenant_admin
  await db.insert(tenantUsers).values({
    tenantId: tenant.id,
    userId: user.id,
    role: 'tenant_admin',
    isActive: true,
  });

  return NextResponse.json(tenant, { status: 201 });
}
