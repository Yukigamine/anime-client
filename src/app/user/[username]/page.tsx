import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UserProfile from "@/components/UserProfile";
import { getKitsuUserProfile } from "@/lib/kitsu/user";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username} – Anime Client` };
}

export const dynamic = "force-dynamic";

export default async function UserPage({ params }: Props) {
  const { username } = await params;
  const profile = await getKitsuUserProfile(username);
  if (!profile) notFound();
  return <UserProfile profile={profile} />;
}
