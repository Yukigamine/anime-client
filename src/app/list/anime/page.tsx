import { Box, Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import AnimeListClient from "@/components/AnimeListClient";
import { getAnimeList, getAnimeListCounts } from "@/lib/list";

export const metadata: Metadata = { title: "Anime List – Anime Client" };
export const dynamic = "force-dynamic";

export default async function AnimeListPage() {
  const [items, counts] = await Promise.all([
    getAnimeList(),
    getAnimeListCounts(),
  ]);

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
