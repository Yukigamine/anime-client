"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { kitsuBrowserClient } from "@/lib/kitsu/browser-client";

type Props = {
  kitsuId: string;
  mediaType: "anime" | "manga";
  fallbackTitle: string;
  extraChips?: ReactNode;
  onCountLoaded?: (count: number | null) => void;
};

type HeroData = {
  title: string;
  secondaryTitle: string | null;
  bannerImageUrl: string | null;
  coverImageUrl: string | null;
  startDate: string | null;
  season: string | null;
  subtype: string | null;
  episodeCount: number | null;
  ageRating: string | null;
};

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 ? result : null;
}

function releaseLabel(
  value: string | null,
  mediaType: Props["mediaType"],
  season: string | null,
): string | null {
  if (mediaType === "anime") {
    if (!season) return null;
    if (!value) return season.toUpperCase();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return season.toUpperCase();
    return `${season.toUpperCase()} ${date.getUTCFullYear()}`;
  }

  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}

export default function ProviderMediaHero({
  kitsuId,
  mediaType,
  fallbackTitle,
  extraChips,
  onCountLoaded,
}: Props) {
  const [data, setData] = useState<HeroData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result =
          mediaType === "anime"
            ? await kitsuBrowserClient("query")({
                findAnimeById: [
                  { id: kitsuId },
                  {
                    titles: {
                      canonical: true,
                      romanized: true,
                      original: true,
                    },
                    startDate: true,
                    season: true,
                    subtype: true,
                    episodeCount: true,
                    ageRating: true,
                    bannerImage: { original: { url: true } },
                    posterImage: { original: { url: true } },
                  },
                ],
              })
            : await kitsuBrowserClient("query")({
                findMangaById: [
                  { id: kitsuId },
                  {
                    titles: {
                      canonical: true,
                      romanized: true,
                      original: true,
                    },
                    startDate: true,
                    chapterCount: true,
                    ageRating: true,
                    bannerImage: { original: { url: true } },
                    posterImage: { original: { url: true } },
                  },
                ],
              });
        const typedResult = result as unknown as {
          findAnimeById?: unknown;
          findMangaById?: unknown;
        };
        const media = (
          mediaType === "anime"
            ? typedResult.findAnimeById
            : typedResult.findMangaById
        ) as
          | {
              titles?: {
                canonical?: unknown;
                romanized?: unknown;
                original?: unknown;
              } | null;
              startDate?: unknown;
              season?: unknown;
              subtype?: unknown;
              episodeCount?: unknown;
              chapterCount?: unknown;
              ageRating?: unknown;
              bannerImage?: { original?: { url?: unknown } | null } | null;
              posterImage?: { original?: { url?: unknown } | null } | null;
            }
          | null
          | undefined;
        if (cancelled) return;
        const count =
          typeof media?.episodeCount === "number"
            ? media.episodeCount
            : typeof media?.chapterCount === "number"
              ? media.chapterCount
              : null;
        onCountLoaded?.(count);
        setData({
          title:
            cleanString(media?.titles?.canonical) ??
            cleanString(media?.titles?.romanized) ??
            fallbackTitle,
          secondaryTitle: cleanString(media?.titles?.original),
          bannerImageUrl: cleanString(media?.bannerImage?.original?.url),
          coverImageUrl: cleanString(media?.posterImage?.original?.url),
          startDate: cleanString(media?.startDate),
          season: cleanString(media?.season),
          subtype: cleanString(media?.subtype),
          episodeCount: count,
          ageRating: cleanString(media?.ageRating),
        });
      } catch {
        if (!cancelled) {
          onCountLoaded?.(null);
          setData({
            title: fallbackTitle,
            secondaryTitle: null,
            bannerImageUrl: null,
            coverImageUrl: null,
            startDate: null,
            season: null,
            subtype: null,
            episodeCount: null,
            ageRating: null,
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fallbackTitle, kitsuId, mediaType, onCountLoaded]);

  const hero = data ?? {
    title: fallbackTitle,
    secondaryTitle: null,
    bannerImageUrl: null,
    coverImageUrl: null,
    startDate: null,
    season: null,
    subtype: null,
    episodeCount: null,
    ageRating: null,
  };
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        px: { xs: 2, sm: 4 },
        py: { xs: 2, sm: 3 },
        color: "common.white",
        backgroundImage: hero.bannerImageUrl
          ? `linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.32)), url(${hero.bannerImageUrl})`
          : "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.55))",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { xs: "flex-start", sm: "flex-end" } }}
      >
        <Box
          sx={{
            width: 124,
            height: 176,
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.2)",
            bgcolor: "grey.800",
            flexShrink: 0,
          }}
        >
          {hero.coverImageUrl && (
            <Box
              component="img"
              src={hero.coverImageUrl}
              alt={hero.title}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {hero.title}
          </Typography>
          {hero.secondaryTitle && hero.secondaryTitle !== hero.title && (
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              {hero.secondaryTitle}
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ mt: 1, flexWrap: "wrap" }}
          >
            <Chip
              label={mediaType === "anime" ? "ANIME" : "MANGA"}
              size="small"
              color="default"
            />
            {mediaType === "anime" && hero.subtype && (
              <Chip label={hero.subtype} size="small" color="default" />
            )}
            {releaseLabel(hero.startDate, mediaType, hero.season) && (
              <Chip
                label={releaseLabel(hero.startDate, mediaType, hero.season)}
                size="small"
                color="default"
              />
            )}
            {hero.episodeCount != null && (
              <Chip
                label={
                  mediaType === "anime"
                    ? `${hero.episodeCount} EPISODES`
                    : `${hero.episodeCount} CHAPTERS`
                }
                size="small"
                color="default"
              />
            )}
            {hero.ageRating && (
              <Chip label={hero.ageRating} size="small" color="default" />
            )}
            {extraChips}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
