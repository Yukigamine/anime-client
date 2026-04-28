import type { Metadata } from "next";
import KitsuLoginForm from "./KitsuLoginForm";

export const metadata: Metadata = { title: "Kitsu Login – Anime Client" };

export default function KitsuLoginPage() {
  const configuredUsername = process.env.NEXT_PUBLIC_KITSU_USERNAME ?? "";
  return <KitsuLoginForm configuredUsername={configuredUsername} />;
}
