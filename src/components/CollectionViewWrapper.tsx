"use client";

import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import { useState } from "react";
import { CollectionItemActions } from "@/components/CollectionItemActions";
import type { ViewMode } from "@/components/CollectionViewToggle";
import { CollectionViewToggle } from "@/components/CollectionViewToggle";
import type {
  Anime,
  AnimeCollectionItem,
  Manga,
  MangaCollectionItem,
} from "@/generated/prisma/client";
import { formatContiguousRanges } from "@/lib/formatRanges";

type AnimeItem = AnimeCollectionItem & { anime: Anime };
type MangaItem = MangaCollectionItem & { manga: Manga };
type Item = AnimeItem | MangaItem;

interface Props<T> {
  items: T[];
  type: "anime" | "manga";
  gridComponent: React.ComponentType<{ items: T[]; isAuthenticated: boolean }>;
  isAuthenticated?: boolean;
}

const RARITY_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  COLLECTORS: "Collector's",
  DELUXE: "Deluxe",
  STEELBOOK: "Steelbook",
  LIMITED: "Limited",
};

const CONDITION_COLORS: Record<
  string,
  "success" | "primary" | "warning" | "error"
> = {
  MINT: "success",
  NEAR_MINT: "success",
  GOOD: "primary",
  FAIR: "warning",
  POOR: "error",
};

const FORMAT_LABELS: Record<string, string> = {
  DVD: "DVD",
  BLU_RAY: "Blu-ray",
  VHS: "VHS",
  DIGITAL: "Digital",
  OTHER: "Other",
};

const LANGUAGE_LABELS: Record<string, string> = {
  ENGLISH: "🇬🇧 English",
  JAPANESE: "🇯🇵 Japanese",
  OTHER: "🌐 Other",
};

export function CollectionViewWrapper<T extends Item>({
  items,
  type,
  gridComponent: GridComponent,
  isAuthenticated = false,
}: Props<T>) {
  const [view, setView] = useState<ViewMode>("grid");

  const getTitle = (item: T): string => {
    if ("anime" in item) {
      const anime = item.anime as Anime;
      return anime.titleEn ?? anime.titleRomaji ?? anime.titleJp ?? "Unknown";
    } else {
      const manga = item.manga as Manga;
      return manga.titleEn ?? manga.titleRomaji ?? manga.titleJp ?? "Unknown";
    }
  };

  const getCoverUrl = (item: T): string => {
    if ("anime" in item) {
      return (item.anime as Anime).coverImageUrl || "/placeholder.png";
    } else {
      return (item.manga as Manga).coverImageUrl || "/placeholder.png";
    }
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <CollectionViewToggle view={view} onViewChange={setView} />
      </Box>

      {view === "grid" ? (
        <GridComponent items={items} isAuthenticated={isAuthenticated} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }} />
                <TableCell>Title</TableCell>
                {type !== "manga" && (
                  <>
                    <TableCell>Rarity</TableCell>
                    <TableCell>Format</TableCell>
                  </>
                )}
                <TableCell>Condition</TableCell>
                {type === "manga" && <TableCell>Language</TableCell>}
                {type !== "manga" && (
                  <>
                    <TableCell>Purchased</TableCell>
                    <TableCell align="right">Price</TableCell>
                  </>
                )}
                {type === "manga" && (
                  <>
                    <TableCell align="center">Volumes</TableCell>
                    <TableCell align="center">Chapters</TableCell>
                  </>
                )}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const title = getTitle(item);
                const coverUrl = getCoverUrl(item);
                const isMangaItem = "manga" in item;
                const mangaItem = isMangaItem ? (item as MangaItem) : null;

                return (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ p: 0.5 }}>
                      <Box
                        component="img"
                        src={coverUrl}
                        alt={title}
                        sx={{
                          width: 40,
                          height: 50,
                          objectFit: "cover",
                          borderRadius: 0.5,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{title}</TableCell>
                    {type !== "manga" && (
                      <>
                        <TableCell>
                          {RARITY_LABELS[(item as AnimeItem).rarity] ??
                            (item as AnimeItem).rarity}
                        </TableCell>
                        <TableCell>
                          {FORMAT_LABELS[(item as AnimeItem).format] ??
                            (item as AnimeItem).format}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Chip
                        label={item.condition}
                        color={CONDITION_COLORS[item.condition] ?? "default"}
                        size="small"
                      />
                    </TableCell>
                    {type === "manga" && (
                      <TableCell>
                        {LANGUAGE_LABELS[(item as MangaItem).language] ??
                          (item as MangaItem).language}
                      </TableCell>
                    )}
                    {type !== "manga" &&
                      (() => {
                        const animeItem = item as AnimeItem;
                        return (
                          <>
                            <TableCell>
                              {animeItem.purchasedAt instanceof Date
                                ? animeItem.purchasedAt.toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell align="right">
                              {animeItem.pricePaid != null
                                ? `$${animeItem.pricePaid.toFixed(2)}`
                                : "—"}
                            </TableCell>
                          </>
                        );
                      })()}
                    {type === "manga" && mangaItem && (
                      <>
                        <TableCell align="center">
                          <Tooltip
                            title={
                              mangaItem.volumes && mangaItem.volumes.length > 0
                                ? `Vol ${formatContiguousRanges(mangaItem.volumes)}`
                                : "No volumes recorded"
                            }
                          >
                            <span>{mangaItem.volumes?.length || 0}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip
                            title={
                              mangaItem.chapters &&
                              mangaItem.chapters.length > 0
                                ? `Ch ${formatContiguousRanges(mangaItem.chapters)}`
                                : "No chapters recorded"
                            }
                          >
                            <span>{mangaItem.chapters?.length || 0}</span>
                          </Tooltip>
                        </TableCell>
                      </>
                    )}
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {isAuthenticated && (
                        <CollectionItemActions
                          id={item.id}
                          type={type}
                          title={title}
                          editHref={`/collection/${type}/${item.id}/edit`}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
