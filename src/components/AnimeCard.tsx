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
import type { AnimeEntry } from "@/generated/prisma/client";

const STATUS_COLORS = {
  WATCHING: "primary",
  PLAN_TO_WATCH: "default",
  COMPLETED: "success",
  ON_HOLD: "warning",
  DROPPED: "error",
} as const;

const STATUS_LABELS = {
  WATCHING: "Watching",
  PLAN_TO_WATCH: "Plan to Watch",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
} as const;

export default function AnimeCard({ entry }: { entry: AnimeEntry }) {
  const title =
    entry.titleEn ?? entry.titleRomaji ?? entry.titleJp ?? "Unknown";
  const progress =
    entry.episodeCount != null
      ? `${entry.progress} / ${entry.episodeCount} ep`
      : `${entry.progress} ep`;

  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "row",
        height: 140,
        overflow: "hidden",
        transition: "transform 0.15s, box-shadow 0.15s",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: 6,
        },
      }}
    >
      {/* Cover image */}
      <Box
        sx={{
          position: "relative",
          width: 93,
          flexShrink: 0,
          bgcolor: "background.default",
        }}
      >
        {entry.coverImageUrl ? (
          <Image
            src={entry.coverImageUrl}
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
              fontSize: 12,
              textAlign: "center",
              p: 1,
            }}
          >
            No image
          </Box>
        )}
      </Box>

      {/* Content */}
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
            fontWeight={600}
            noWrap
            sx={{ lineHeight: 1.3 }}
          >
            {title}
          </Typography>
        </Tooltip>

        {entry.titleJp && entry.titleJp !== title && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {entry.titleJp}
          </Typography>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: "auto" }}>
          <Chip
            label={STATUS_LABELS[entry.watchStatus]}
            color={STATUS_COLORS[entry.watchStatus]}
            size="small"
            sx={{ fontWeight: 500 }}
          />
          <Typography variant="body2" color="text.secondary">
            {progress}
          </Typography>
          {entry.rewatchCount > 0 && (
            <Typography variant="caption" color="text.disabled">
              ×{entry.rewatchCount}
            </Typography>
          )}
        </Box>

        {entry.rating != null && (
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

        {entry.notes && (
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
