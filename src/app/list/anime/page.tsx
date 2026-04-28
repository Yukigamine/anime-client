import { Box, Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import AnimeListClient from "@/components/AnimeListClient";
import { getAnimeList, getAnimeListCounts } from "@/lib/list";

export const metadata: Metadata = { title: "Anime List – Anime Client" };
export const dynamic = "force-dynamic";

export default async function AnimeListPage() {
  let items = [];
  let counts = {};

  try {
    [items, counts] = await Promise.all([getAnimeList(), getAnimeListCounts()]);
  } catch (e) {
    let err = "Unknown error";
    if (e instanceof Error) {
      err = e.message;
    } else if (e && typeof e === "object" && "message" in e) {
      err = String((e as { message: unknown }).message);
    } else if (typeof e === "string") {
      err = e;
    }
    console.error("Failed to load anime list:", err, e);
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
          Anime List
        </Typography>
        <Box sx={{ textAlign: "center", py: 12 }}>
          <Typography variant="h5" color="error" gutterBottom>
            Error loading list
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {err}
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
        Anime List
      </Typography>

      {items.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 12 }}>
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No anime yet
          </Typography>
          <Typography variant="body1" color="text.disabled">
            Go to the{" "}
            <a href="/sync" style={{ color: "inherit" }}>
              Sync page
            </a>{" "}
            to import your list from Kitsu or AniList.
          </Typography>
        </Box>
      ) : (
        <AnimeListClient items={items} counts={counts} />
      )}
    </Container>
  );
}
