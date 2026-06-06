import { createAuthClient } from "better-auth/react";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

// Browser-side Better Auth client. Exposes signUp.email / signIn.email /
// signOut / getSession used by the auth forms and the nav.
// inferAdditionalFields<typeof auth> propagates the server-side additionalFields
// (phone/skillLevel/nickname) into the typed signUp.email params.
export const authClient = createAuthClient({
  plugins: [adminClient(), inferAdditionalFields<typeof auth>()],
});
