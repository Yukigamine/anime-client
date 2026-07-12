import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { CollectionViewWrapper } from "@/components/CollectionViewWrapper";
import AppLink from "@/components/Link";
import { MangaCollectionGrid } from "@/components/MangaCollectionGrid";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Manga Collection – Tsuki Client" };
export const dynamic = "force-dynamic";

const _FORMAT_LABELS: Record<string, string> = {
  DVD: "DVD",
  BLU_RAY: "Blu-ray",
  VHS: "VHS",
  DIGITAL: "Digital",
  LIMITED_EDITION: "Limited Edition",
  OTHER: "Physical",
};

const _CONDITION_COLORS: Record<
  string,
  "success" | "primary" | "warning" | "error"
> = {
  MINT: "success",
  NEAR_MINT: "success",
  GOOD: "primary",
  FAIR: "warning",
  POOR: "error",
};

export default async function MangaCollectionPage() {
  const [items, session] = await Promise.all([
    prisma.mangaCollectionItem.findMany({
      include: { manga: true },
      orderBy: [{ manga: { titleEn: "asc" } }, { createdAt: "asc" }],
    }),
    getSession(),
  ]);
  const isAuthenticated = !!session;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Manga Collection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        {isAuthenticated && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={AppLink}
            href="/collection/manga/add"
            sx={{ textTransform: "none" }}
          >
            Add item
          </Button>
        )}
      </Box>

      {items.length === 0 ? (
        <Stack spacing={2} sx={{ py: 10, alignItems: "center" }}>
          <Typography variant="h5" color="text.secondary">
            Your collection is empty
          </Typography>
          <Typography
            sx={{ color: "text.disabled", textAlign: "center", maxWidth: 400 }}
          >
            Track your physical manga volumes here. Use the Add item button to
            get started.
          </Typography>
        </Stack>
      ) : (
        <CollectionViewWrapper
          items={items}
          type="manga"
          gridComponent={MangaCollectionGrid}
          isAuthenticated={isAuthenticated}
        />
      )}
    </Container>
  );
}
