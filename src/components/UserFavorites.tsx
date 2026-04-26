"use client";

import { Box, Tab, Tabs, Typography } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { KitsuFavoriteItem } from "@/lib/kitsu/user";

const TYPE_LABELS: Record<KitsuFavoriteItem["type"], string> = {
  anime: "Anime",
  manga: "Manga",
  character: "Characters",
  person: "People",
};

const TYPE_HREFS: Record<KitsuFavoriteItem["type"], string> = {
  anime: "https://kitsu.app/anime",
  manga: "https://kitsu.app/manga",
  character: "https://kitsu.app/characters",
  person: "https://kitsu.app/people",
};

function FavoriteCard({ item }: { item: KitsuFavoriteItem }) {
  return (
    <Box
      component={Link}
      href={`${TYPE_HREFS[item.type]}/${item.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        textDecoration: "none",
        color: "inherit",
        width: 110,
        flexShrink: 0,
        "&:hover .fav-img": { boxShadow: 4, transform: "translateY(-2px)" },
      }}
    >
      <Box
        className="fav-img"
        sx={{
          position: "relative",
          width: 110,
          height: 155,
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "action.hover",
          transition: "box-shadow 0.15s, transform 0.15s",
          flexShrink: 0,
        }}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="110px"
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
      <Typography
        variant="caption"
        sx={{
          textAlign: "center",
          lineHeight: 1.3,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          maxWidth: "100%",
        }}
      >
        {item.name}
      </Typography>
    </Box>
  );
}

export default function UserFavorites({
  favorites,
}: {
  favorites: {
    anime: KitsuFavoriteItem[];
    manga: KitsuFavoriteItem[];
    character: KitsuFavoriteItem[];
    person: KitsuFavoriteItem[];
  };
}) {
  const types = (
    ["anime", "manga", "character", "person"] as KitsuFavoriteItem["type"][]
  ).filter((t) => favorites[t].length > 0);

  const [activeTab, setActiveTab] = useState<KitsuFavoriteItem["type"]>(
    types[0] ?? "anime",
  );

  if (types.length === 0) return null;

  const sorted = [...favorites[activeTab]].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v as KitsuFavoriteItem["type"])}
        sx={{ mb: 2 }}
      >
        {types.map((t) => (
          <Tab
            key={t}
            value={t}
            label={`${TYPE_LABELS[t]} (${favorites[t].length})`}
            sx={{ textTransform: "none" }}
          />
        ))}
      </Tabs>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        {sorted.map((item) => (
          <FavoriteCard key={item.id} item={item} />
        ))}
      </Box>
    </Box>
  );
}
