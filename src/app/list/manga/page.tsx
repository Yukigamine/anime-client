import { Box, Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import KitsuOwnedMediaTitle from "@/components/KitsuOwnedMediaTitle";
import ListAddButton from "@/components/ListAddButton";
import MangaListClient from "@/components/MangaListClient";
import { getMangaListSnapshot } from "@/lib/list";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Manga List – Tsuki Client" };
export const dynamic = "force-dynamic";

export default async function MangaListPage() {
  let items: Awaited<ReturnType<typeof getMangaListSnapshot>>["items"] = [];
  let counts: Awaited<ReturnType<typeof getMangaListSnapshot>>["counts"] = {};
  let isAuthenticated = false;

  try {
    const [snapshot, session] = await Promise.all([
      getMangaListSnapshot(),
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
    console.error("Failed to load manga list:", err, e);
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <KitsuOwnedMediaTitle mediaTitle="Manga List" />
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
        <KitsuOwnedMediaTitle mediaTitle="Manga List" />
        {isAuthenticated && (
          <ListAddButton
            type="manga"
            existingKitsuIds={items.flatMap((item) =>
              item.kitsuId ? [item.kitsuId] : [],
            )}
          />
        )}
      </Box>

      <MangaListClient items={items} counts={counts} />
    </Container>
  );
}
