import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

// One-time setup endpoint. Protected by SETUP_TOKEN env var.
// DELETE this file after first-time setup is complete.
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-setup-token');
  if (!process.env.SETUP_TOKEN || token !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { adminEmail, adminPassword, adminName } = await req.json();
  if (!adminEmail || !adminPassword || !adminName) {
    return NextResponse.json({ error: 'adminEmail, adminPassword, adminName required' }, { status: 400 });
  }

  const client = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    // 1. Create enums (idempotent)
    await client.unsafe(`
      DO $$ BEGIN
        CREATE TYPE plan AS ENUM ('starter','growth','enterprise','custom');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE tenant_status AS ENUM ('active','suspended','trial');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // 2. Create public schema tables
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT UNIQUE NOT NULL,
        company_name TEXT NOT NULL,
        ntn TEXT,
        strn TEXT,
        business_address TEXT,
        contact_person TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        plan plan NOT NULL DEFAULT 'starter',
        status tenant_status NOT NULL DEFAULT 'active',
        schema_name TEXT NOT NULL,
        suspended_reason TEXT,
        suspended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        is_super_admin BOOLEAN DEFAULT false,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tenant_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        branch_id UUID,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID,
        user_id UUID,
        user_email TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id UUID,
        old_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS hs_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hs_code TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        cd_pct NUMERIC(5,2) DEFAULT 0,
        acd_pct NUMERIC(5,2) DEFAULT 0,
        rd_pct NUMERIC(5,2) DEFAULT 0,
        st_pct NUMERIC(5,2) DEFAULT 17,
        wht_pct NUMERIC(5,2) DEFAULT 4.5,
        at_pct NUMERIC(5,2) DEFAULT 5.5,
        applicable_sros TEXT,
        is_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS currencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        symbol TEXT,
        rate_to_usd NUMERIC(18,6),
        rate_to_pkr NUMERIC(18,4),
        updated_at TIMESTAMPTZ DEFAULT now(),
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS ports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        city TEXT,
        country TEXT DEFAULT 'PK',
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS shipping_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        scac TEXT,
        free_days INTEGER DEFAULT 14,
        detention_free_days INTEGER DEFAULT 14,
        contact_email TEXT,
        contact_phone TEXT,
        website TEXT,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS countries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        is_preferred_trade_lane BOOLEAN DEFAULT false
      );
    `);

    // 3. Seed currencies
    await client.unsafe(`
      INSERT INTO currencies (code, name, symbol, rate_to_usd, rate_to_pkr) VALUES
        ('USD', 'US Dollar', '$', 1.0, 278.5),
        ('EUR', 'Euro', '€', 0.92, 302.3),
        ('CNY', 'Chinese Yuan', '¥', 7.25, 38.4),
        ('AED', 'UAE Dirham', 'AED', 3.67, 75.8),
        ('GBP', 'British Pound', '£', 0.79, 351.2),
        ('PKR', 'Pakistani Rupee', '₨', 278.5, 1.0)
      ON CONFLICT (code) DO NOTHING;
    `);

    // 4. Seed Pakistan ports
    await client.unsafe(`
      INSERT INTO ports (code, name, type, city) VALUES
        ('PKKHI', 'Karachi Port', 'sea', 'Karachi'),
        ('PKQCT', 'Qasim Port', 'sea', 'Karachi'),
        ('PKKHI_AP', 'Karachi Airport (JIAP)', 'air', 'Karachi'),
        ('PKLHE_AP', 'Lahore Airport (Allama Iqbal)', 'air', 'Lahore'),
        ('PKISD_AP', 'Islamabad Airport (BBIA)', 'air', 'Islamabad'),
        ('PKWAH', 'Wahga Land Crossing', 'land', 'Lahore'),
        ('PKTOR', 'Torkham Land Crossing', 'land', 'Peshawar')
      ON CONFLICT (code) DO NOTHING;
    `);

    // 5. Create super admin user
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const result = await client`
      INSERT INTO users (email, name, password_hash, is_super_admin)
      VALUES (${adminEmail}, ${adminName}, ${passwordHash}, true)
      ON CONFLICT (email) DO UPDATE SET
        is_super_admin = true,
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash
      RETURNING id, email, name, is_super_admin
    `;

    return NextResponse.json({
      ok: true,
      message: 'Setup complete. Tables created, super admin seeded.',
      user: result[0],
    });
  } catch (err: any) {
    console.error('Setup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
