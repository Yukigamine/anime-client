export interface KitsuUser {
  id: string;
  attributes: { name: string };
}

// ─── Anime ────────────────────────────────────────────────────────────────────

export interface KitsuAnimeAttributes {
  canonicalTitle: string;
  titles: { en?: string; en_jp?: string; ja_jp?: string };
  description: string | null;
  episodeCount: number | null;
  status: "current" | "finished" | "tba" | "unreleased" | "upcoming";
  posterImage: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  } | null;
  coverImage: { small?: string; large?: string } | null;
  averageRating: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface KitsuAnime {
  id: string;
  type: "anime";
  attributes: KitsuAnimeAttributes;
}

// ─── Manga ────────────────────────────────────────────────────────────────────

export interface KitsuMangaAttributes {
  canonicalTitle: string;
  titles: { en?: string; en_jp?: string; ja_jp?: string };
  description: string | null;
  chapterCount: number | null;
  volumeCount: number | null;
  status: "current" | "finished" | "tba" | "unreleased" | "upcoming";
  posterImage: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  } | null;
  averageRating: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface KitsuManga {
  id: string;
  type: "manga";
  attributes: KitsuMangaAttributes;
}

// ─── Library Entries ─────────────────────────────────────────────────────────

export type KitsuWatchStatus =
  | "current"
  | "planned"
  | "completed"
  | "on_hold"
  | "dropped";

export interface KitsuLibraryEntryAttributes {
  status: KitsuWatchStatus;
  progress: number;
  volumesOwned: number;
  ratingTwenty: number | null;
  notes: string | null;
  private: boolean;
  reconsuming: boolean;
  reconsumeCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface KitsuAnimeLibraryEntry {
  id: string;
  type: "libraryEntries";
  attributes: KitsuLibraryEntryAttributes;
  relationships: {
    anime: { data: { id: string; type: "anime" } };
  };
}

export interface KitsuMangaLibraryEntry {
  id: string;
  type: "libraryEntries";
  attributes: KitsuLibraryEntryAttributes;
  relationships: {
    manga: { data: { id: string; type: "manga" } };
  };
}

export interface KitsuAnimeLibraryResponse {
  data: KitsuAnimeLibraryEntry[];
  included: KitsuAnime[];
  links: { first?: string; next?: string; last?: string };
  meta: { count: number };
}

export interface KitsuMangaLibraryResponse {
  data: KitsuMangaLibraryEntry[];
  included: KitsuManga[];
  links: { first?: string; next?: string; last?: string };
  meta: { count: number };
}
