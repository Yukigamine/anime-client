import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UserProfile from "@/components/UserProfile";
import { getToken } from "@/lib/auth";
import { getKitsuUserProfile } from "@/lib/kitsu/user";

export const metadata: Metadata = { title: "About Me – Anime Client" };
export const dynamic = "force-dynamic";

export default async function MePage() {
  const token = await getToken("KITSU");

  if (!token?.username) {
    redirect("/login");
  }

  const profile = await getKitsuUserProfile(token.username);

  if (!profile) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Profile not found</h2>
        <p>
          Could not load profile for &ldquo;{token.username}&rdquo; from Kitsu.
        </p>
      </div>
    );
  }

  return <UserProfile profile={profile} />;
}
