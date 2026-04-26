"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Rating,
  Tooltip,
  Typography,
} from "@mui/material";
import Image from "next/image";
import type { MangaListEntry } from "@/generated/prisma/client";
import type { MangaWithEntry } from "@/lib/list";

const STATUS_COLORS = {
  READING: "primary",
  PLAN_TO_READ: "default",
  COMPLETED: "success",
  ON_HOLD: "warning",
  DROPPED: "error",
} as const;

const STATUS_LABELS: Record<MangaListEntry["readStatus"], string> = {
  READING: "Reading",
  PLAN_TO_READ: "Plan to Read",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
};

export default function MangaCard({ item }: { item: MangaWithEntry }) {
  const entry = item.listEntry;
  const title = item.titleEn ?? item.titleRomaji ?? item.titleJp ?? "Unknown";

  const chapterProgress =
    item.chapterCount != null
      ? `${entry?.progress ?? 0} / ${item.chapterCount} ch`
      : `${entry?.progress ?? 0} ch`;

  const volumeProgress =
    (entry?.progressVolumes ?? 0) > 0
      ? item.volumeCount != null
        ? `${entry?.progressVolumes} / ${item.volumeCount} vol`
        : `${entry?.progressVolumes} vol`
      : null;

  return (
    <Card
      sx={{
        display: "flex",
        height: 140,
        overflow: "hidden",
        transition: "transform 0.15s, box-shadow 0.15s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 6 },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: 93,
          flexShrink: 0,
          bgcolor: "background.default",
        }}
      >
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={title}
            fill
            sizes="93px"
            style={{ objectFit: "cover" }}
            unoptimized
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.disabled",
              fontSize: 11,
              textAlign: "center",
              p: 0.5,
            }}
          >
            No image
          </Box>
        )}
      </Box>

      <CardContent
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          py: 1.5,
          px: 2,
          "&:last-child": { pb: 1.5 },
          overflow: "hidden",
        }}
      >
        <Tooltip title={title} placement="top-start">
          <Typography
            variant="subtitle1"
            noWrap
            sx={{ fontWeight: 600, lineHeight: 1.3 }}
          >
            {title}
          </Typography>
        </Tooltip>

        {item.titleJp && item.titleJp !== title && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {item.titleJp}
          </Typography>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mt: "auto",
            flexWrap: "wrap",
          }}
        >
          {entry && (
            <Chip
              label={STATUS_LABELS[entry.readStatus]}
              color={STATUS_COLORS[entry.readStatus]}
              size="small"
              sx={{ fontWeight: 500 }}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {chapterProgress}
          </Typography>
          {volumeProgress && (
            <Typography variant="body2" color="text.secondary">
              · {volumeProgress}
            </Typography>
          )}
          {(entry?.rereadCount ?? 0) > 0 && (
            <Typography variant="caption" color="text.disabled">
              ×{entry?.rereadCount}
            </Typography>
          )}
        </Box>

        {entry?.rating != null && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Rating
              value={entry.rating / 2}
              precision={0.5}
              size="small"
              readOnly
            />
            <Typography variant="caption" color="text.secondary">
              {entry.rating.toFixed(1)}
            </Typography>
          </Box>
        )}

        {entry?.notes && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
            }}
          >
            {entry.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
