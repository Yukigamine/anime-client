import type { Metadata } from "next";
import KitsuLoginForm from "./KitsuLoginForm";

export const metadata: Metadata = { title: "Kitsu Login – Anime Client" };

export default function KitsuLoginPage() {
  return <KitsuLoginForm />;
}
