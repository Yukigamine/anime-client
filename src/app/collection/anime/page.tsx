import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { AnimeCollectionGrid } from "@/components/AnimeCollectionGrid";
import { CollectionViewWrapper } from "@/components/CollectionViewWrapper";
import KitsuOwnedMediaTitle from "@/components/KitsuOwnedMediaTitle";
import AppLink from "@/components/Link";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Anime Collection – Tsuki Anime" };
export const dynamic = "force-dynamic";

const _FORMAT_LABELS: Record<string, string> = {
  DVD: "DVD",
  BLU_RAY: "Blu-ray",
  VHS: "VHS",
  DIGITAL: "Digital",
  LIMITED_EDITION: "Limited Edition",
  OTHER: "Other",
};

const _RARITY_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  COLLECTORS: "Collector's",
  DELUXE: "Deluxe",
  STEELBOOK: "Steelbook",
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

export default async function AnimeCollectionPage() {
  const [items, session] = await Promise.all([
    prisma.animeCollectionItem.findMany({
      include: { anime: true },
      orderBy: [{ anime: { titleEn: "asc" } }, { createdAt: "asc" }],
    }),
    getSession(),
  ]);
  const isAuthenticated = !!session;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          mb: 4,
        }}
      >
        <KitsuOwnedMediaTitle mediaTitle="Anime Collection" />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Typography>
          {isAuthenticated && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              component={AppLink}
              href="/collection/anime/add"
              sx={{
                textTransform: "none",
                whiteSpace: "nowrap",
                width: "fit-content",
                flexShrink: 0,
              }}
            >
              Add
            </Button>
          )}
        </Box>
      </Box>

      {items.length === 0 ? (
        <Stack spacing={2} sx={{ py: 10, alignItems: "center" }}>
          <Typography variant="h5" color="text.secondary">
            Your collection is empty
          </Typography>
          <Typography
            sx={{ color: "text.disabled", textAlign: "center", maxWidth: 400 }}
          >
            Track your physical and digital anime collection here. Use the Add
            item button to get started.
          </Typography>
        </Stack>
      ) : (
        <CollectionViewWrapper
          items={items}
          type="anime"
          gridComponent={AnimeCollectionGrid}
          isAuthenticated={isAuthenticated}
        />
      )}
    </Container>
  );
}
