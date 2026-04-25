import { Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildAniListAuthUrl } from "@/lib/anilist/auth";

export const metadata: Metadata = { title: "AniList Login – Anime Client" };

export default function AniListLoginPage() {
  // Build the URL server-side so no env vars leak to the client
  const authUrl = buildAniListAuthUrl();

  // If no client ID is configured, show an error rather than a broken redirect
  if (!process.env.ANILIST_CLIENT_ID) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          AniList not configured
        </Typography>
        <Typography color="text.secondary">
          Set <code>ANILIST_CLIENT_ID</code>, <code>ANILIST_CLIENT_SECRET</code>
          , and <code>ANILIST_REDIRECT_URI</code> in your environment to enable
          AniList OAuth.
        </Typography>
      </Container>
    );
  }

  // Redirect immediately via the server so the browser goes straight to AniList
  redirect(authUrl);
}
