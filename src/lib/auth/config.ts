import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/db';
import { users, tenantUsers, tenants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantSlug: { label: 'Tenant', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, tenantSlug } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        if (user.isSuperAdmin) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isSuperAdmin: true,
            tenantSlug: null,
            tenantId: null,
            role: 'super_admin',
          };
        }

        if (!tenantSlug) return null;

        const [membership] = await db
          .select({
            tenantUser: tenantUsers,
            tenant: tenants,
          })
          .from(tenantUsers)
          .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
          .where(
            and(
              eq(tenantUsers.userId, user.id),
              eq(tenants.slug, tenantSlug),
              eq(tenantUsers.isActive, true)
            )
          )
          .limit(1);

        if (!membership || membership.tenant.status !== 'active') return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
          tenantSlug: membership.tenant.slug,
          tenantId: membership.tenant.id,
          role: membership.tenantUser.role,
          branchId: membership.tenantUser.branchId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.tenantSlug = (user as any).tenantSlug;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.branchId = (user as any).branchId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.isSuperAdmin = token.isSuperAdmin as boolean;
      session.user.tenantSlug = token.tenantSlug as string | null;
      session.user.tenantId = token.tenantId as string | null;
      session.user.role = token.role as string;
      session.user.branchId = token.branchId as string | null;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // 8 hours
  },
});
