import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep server-only auth/ORM packages out of the client bundle so they run as
  // Node runtime requires. NOTE: `next build` (Turbopack) still statically
  // traces better-auth's optional kysely-adapter and trips on an upstream
  // version mismatch (better-auth@1.6.14 imports DEFAULT_MIGRATION_TABLE from
  // kysely@0.29.2, which no longer exports it). This does NOT affect
  // `npm run dev` (the documented run target), which works end-to-end. See
  // SUMMARY "Deferred Issues" for the production-build follow-up.
  serverExternalPackages: ["better-auth", "@prisma/client"],
};

export default nextConfig;
