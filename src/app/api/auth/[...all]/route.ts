import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/betterauth";

export const { GET, POST } = toNextJsHandler(auth);
