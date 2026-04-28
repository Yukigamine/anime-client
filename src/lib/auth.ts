import "server-only";
import { cookies } from "next/headers";
import type { Provider } from "@/generated/prisma/client";
import prisma from "./prisma";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

const COOKIE_NAMES: Record<Provider, string> = {
  KITSU: "kitsu_access_token",
  ANILIST: "anilist_access_token",
};

export interface TokenInfo {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  username?: string | null;
  providerUserId?: string | null;
}

export async function saveToken(
  provider: Provider,
  info: TokenInfo,
): Promise<void> {
  await prisma.authToken.upsert({
    where: { provider },
    create: {
      provider,
      accessToken: info.accessToken,
      refreshToken: info.refreshToken ?? null,
      expiresAt: info.expiresAt ?? null,
      username: info.username ?? null,
      providerUserId: info.providerUserId ?? null,
    },
    update: {
      accessToken: info.accessToken,
      refreshToken: info.refreshToken ?? undefined,
      expiresAt: info.expiresAt ?? undefined,
      username: info.username ?? undefined,
      providerUserId: info.providerUserId ?? undefined,
    },
  });

  const jar = await cookies();
  jar.set(COOKIE_NAMES[provider], info.accessToken, COOKIE_OPTS);
}

export async function getToken(provider: Provider): Promise<TokenInfo | null> {
  const jar = await cookies();
  const cookie = jar.get(COOKIE_NAMES[provider]);
  if (cookie?.value) {
    const record = await prisma.authToken.findUnique({ where: { provider } });
    return {
      accessToken: cookie.value,
      refreshToken: record?.refreshToken,
      expiresAt: record?.expiresAt,
      username: record?.username,
      providerUserId: record?.providerUserId,
    };
  }

  // Fall back to DB (e.g. after server restart)
  const record = await prisma.authToken.findUnique({ where: { provider } });
  if (!record) return null;

  jar.set(COOKIE_NAMES[provider], record.accessToken, COOKIE_OPTS);

  return {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresAt: record.expiresAt,
    username: record.username,
    providerUserId: record.providerUserId,
  };
}

export async function deleteToken(provider: Provider): Promise<void> {
  await prisma.authToken.deleteMany({ where: { provider } });
  const jar = await cookies();
  jar.delete(COOKIE_NAMES[provider]);
}

export async function getAuthStatus(): Promise<
  Record<Provider, { loggedIn: boolean; username: string | null }>
> {
  const [kitsu, anilist] = await Promise.all([
    prisma.authToken.findUnique({ where: { provider: "KITSU" } }),
    prisma.authToken.findUnique({ where: { provider: "ANILIST" } }),
  ]);
  return {
    KITSU: { loggedIn: !!kitsu, username: kitsu?.username ?? null },
    ANILIST: { loggedIn: !!anilist, username: anilist?.username ?? null },
  };
}
