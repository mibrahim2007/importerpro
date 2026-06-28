import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Module-level cache — survives across requests within the same serverless instance
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
  tenantClients: Map<string, ReturnType<typeof drizzle>> | undefined;
};

const client =
  globalForDb.client ??
  postgres(connectionString, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
  });

globalForDb.client = client;

if (!globalForDb.tenantClients) {
  globalForDb.tenantClients = new Map();
}
const tenantDbCache = globalForDb.tenantClients;

// Public schema DB (platform-level tables)
export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' });

// Tenant-scoped DB — cached per schema so each serverless instance reuses the pool
export function getTenantDb(tenantSlug: string) {
  const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
  if (tenantDbCache.has(schemaName)) return tenantDbCache.get(schemaName)!;
  const tenantClient = postgres(connectionString, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
    connection: { search_path: `${schemaName},public` },
  });
  const tdb = drizzle(tenantClient, { schema, logger: process.env.NODE_ENV === 'development' });
  tenantDbCache.set(schemaName, tdb);
  return tdb;
}
