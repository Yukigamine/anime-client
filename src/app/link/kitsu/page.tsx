import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import KitsuLoginForm from "./KitsuLoginForm";

export const metadata: Metadata = { title: "Kitsu Login – Anime Client" };

export default async function KitsuLoginPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const configuredUsername = process.env.NEXT_PUBLIC_KITSU_USERNAME ?? "";
  return <KitsuLoginForm configuredUsername={configuredUsername} />;
}
