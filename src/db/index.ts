import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Global connection pool (shared across requests)
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.client ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client;
}

// Public schema DB (platform-level tables)
export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' });

// Tenant-scoped DB — injects schema via search_path
export async function getTenantDb(tenantSlug: string) {
  const tenantClient = postgres(connectionString, { max: 5 });
  await tenantClient`SET search_path TO ${tenantClient(tenantSlug)}, public`;
  return drizzle(tenantClient, { schema, logger: process.env.NODE_ENV === 'development' });
}
