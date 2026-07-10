import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getClientBaseUrl } from "@/lib/base-url";

export const authClient = createAuthClient({
  baseURL: getClientBaseUrl(),
  plugins: [genericOAuthClient()],
});
