import { Box, Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import MangaListClient from "@/components/MangaListClient";
import { getMangaList, getMangaListCounts } from "@/lib/list";

export const metadata: Metadata = { title: "Manga List – Anime Client" };
export const dynamic = "force-dynamic";

export default async function MangaListPage() {
  const [items, counts] = await Promise.all([
    getMangaList(),
    getMangaListCounts(),
  ]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Manga List
      </Typography>

      {items.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 12 }}>
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No manga yet
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
        <MangaListClient items={items} counts={counts} />
      )}
    </Container>
  );
}
