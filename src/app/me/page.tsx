import type { Metadata } from "next";
import UserProfileContent from "@/components/UserProfileContent";

const username = process.env.NEXT_PUBLIC_KITSU_USERNAME ?? "";
export const metadata: Metadata = { title: `About ${username}` };

export default function MePage() {
  return <UserProfileContent username={username} />;
}
