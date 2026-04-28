"use client";

import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Grid,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { AnimeWithEntry } from "@/lib/list";
import AnimeCard from "./AnimeCard";
import CardSkeleton from "./CardSkeleton";

type StatusTab =
  | "ALL"
  | "WATCHING"
  | "COMPLETED"
  | "PLAN_TO_WATCH"
  | "ON_HOLD"
  | "DROPPED";

const TABS: { value: StatusTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "WATCHING", label: "Watching" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PLAN_TO_WATCH", label: "Plan to Watch" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "DROPPED", label: "Dropped" },
];

export default function AnimeListClient({
  items,
  counts,
}: {
  items: AnimeWithEntry[];
  counts: Record<string, number>;
}) {
  const [activeTab, setActiveTab] = useState<StatusTab>("ALL");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const tabCacheRef = useRef<Record<StatusTab, AnimeWithEntry[]>>({} as any);

  useEffect(() => {
    const cache: Record<StatusTab, AnimeWithEntry[]> = {} as any;
    TABS.forEach(({ value: tab }) => {
      if (tab === "ALL") {
        cache[tab] = items;
      } else {
        cache[tab] = items.filter((i) => i.listEntry?.watchStatus === tab);
      }
    });
    tabCacheRef.current = cache;
  }, [items]);

  const filtered = useMemo(() => {
    let list = tabCacheRef.current[activeTab] ?? items;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.titleEn ?? "").toLowerCase().includes(q) ||
          (i.titleRomaji ?? "").toLowerCase().includes(q) ||
          (i.titleJp ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeTab, search, items]);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { sm: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => {
            if (search) {
              startTransition(() => setActiveTab(v as StatusTab));
            } else {
              setActiveTab(v as StatusTab);
            }
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, minHeight: 40 }}
        >
          {TABS.map(({ value, label }) => (
            <Tab
              key={value}
              value={value}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {label}
                  {counts[value] != null && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        bgcolor: "action.selected",
                        borderRadius: 1,
                        px: 0.6,
                        py: 0.1,
                        fontWeight: 600,
                      }}
                    >
                      {counts[value]}
                    </Typography>
                  )}
                </Box>
              }
              sx={{ minHeight: 40, textTransform: "none", fontWeight: 500 }}
            />
          ))}
        </Tabs>

        <TextField
          size="small"
          placeholder="Search…"
          value={search}
          onChange={(e) => startTransition(() => setSearch(e.target.value))}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: { xs: "100%", sm: 220 } }}
        />
      </Box>

      {isPending ? (
        <Grid container spacing={2}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <CardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="h6">No entries found</Typography>
          {search && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Try a different search term
            </Typography>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <AnimeCard item={item} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
