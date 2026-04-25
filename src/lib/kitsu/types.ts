export interface KitsuUser {
  id: string;
  attributes: {
    name: string;
  };
}

export interface KitsuAnimeAttributes {
  canonicalTitle: string;
  titles: {
    en?: string;
    en_jp?: string;
    ja_jp?: string;
  };
  episodeCount: number | null;
  status: "current" | "finished" | "tba" | "unreleased" | "upcoming";
  posterImage: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  } | null;
}

export interface KitsuAnime {
  id: string;
  type: "anime";
  attributes: KitsuAnimeAttributes;
}

export interface KitsuLibraryEntryAttributes {
  status: "current" | "planned" | "completed" | "on_hold" | "dropped";
  progress: number;
  ratingTwenty: number | null;
  notes: string | null;
  private: boolean;
  reconsuming: boolean;
  reconsumeCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface KitsuLibraryEntry {
  id: string;
  type: "libraryEntries";
  attributes: KitsuLibraryEntryAttributes;
  relationships: {
    anime: {
      data: { id: string; type: "anime" };
    };
  };
}

export interface KitsuLibraryResponse {
  data: KitsuLibraryEntry[];
  included: KitsuAnime[];
  links: {
    first?: string;
    next?: string;
    last?: string;
  };
  meta: {
    count: number;
  };
}
