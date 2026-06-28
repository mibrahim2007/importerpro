import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    isSuperAdmin: boolean;
    tenantSlug: string | null;
    tenantId: string | null;
    role: string;
    branchId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      isSuperAdmin: boolean;
      tenantSlug: string | null;
      tenantId: string | null;
      role: string;
      branchId?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    isSuperAdmin: boolean;
    tenantSlug: string | null;
    tenantId: string | null;
    role: string;
    branchId?: string | null;
  }
}
