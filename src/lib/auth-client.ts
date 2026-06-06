import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// Browser-side Better Auth client. Exposes signUp.email / signIn.email /
// signOut / getSession used by the auth forms and the nav.
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
