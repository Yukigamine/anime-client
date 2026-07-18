import { Box, Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import AnimeListClient from "@/components/AnimeListClient";
import KitsuOwnedMediaTitle from "@/components/KitsuOwnedMediaTitle";
import ListAddButton from "@/components/ListAddButton";
import { getAnimeListSnapshot } from "@/lib/list";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Anime List – Tsuki Client" };
export const dynamic = "force-dynamic";

export default async function AnimeListPage() {
  let items: Awaited<ReturnType<typeof getAnimeListSnapshot>>["items"] = [];
  let counts: Awaited<ReturnType<typeof getAnimeListSnapshot>>["counts"] = {};
  let isAuthenticated = false;

  try {
    const [snapshot, session] = await Promise.all([
      getAnimeListSnapshot(),
      getSession(),
    ]);
    items = snapshot.items;
    counts = snapshot.counts;
    isAuthenticated = !!session;
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
        <KitsuOwnedMediaTitle mediaTitle="Anime List" />
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
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-end", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 4,
          "& > .MuiTypography-root": { mb: 0 },
        }}
      >
        <KitsuOwnedMediaTitle mediaTitle="Anime List" />
        {isAuthenticated && (
          <ListAddButton
            type="anime"
            existingKitsuIds={items.flatMap((item) =>
              item.kitsuId ? [item.kitsuId] : [],
            )}
          />
        )}
      </Box>

      <AnimeListClient items={items} counts={counts} />
    </Container>
  );
}
