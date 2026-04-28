export type AniListStatus =
  | "CURRENT"
  | "COMPLETED"
  | "PLANNING"
  | "PAUSED"
  | "DROPPED"
  | "REPEATING";

export type AniListMediaStatus =
  | "FINISHED"
  | "RELEASING"
  | "NOT_YET_RELEASED"
  | "CANCELLED"
  | "HIATUS";

export interface AniListFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListMediaTitle {
  english: string | null;
  romaji: string | null;
  native: string | null;
}

export interface AniListCoverImage {
  large: string | null;
  medium: string | null;
}

export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: AniListMediaTitle;
  description: string | null;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  status: AniListMediaStatus;
  coverImage: AniListCoverImage;
  bannerImage: string | null;
  averageScore: number | null;
  startDate: AniListFuzzyDate;
  endDate: AniListFuzzyDate;
}

export interface AniListMediaList {
  id: number;
  status: AniListStatus;
  progress: number;
  progressVolumes: number | null;
  score: number;
  notes: string | null;
  repeat: number;
  private: boolean;
  startedAt: AniListFuzzyDate;
  completedAt: AniListFuzzyDate;
  updatedAt: number;
  media: AniListMedia;
}

export interface AniListPageInfo {
  hasNextPage: boolean;
  currentPage: number;
}

export interface AniListListResponse {
  data: {
    Page: {
      pageInfo: AniListPageInfo;
      mediaList: AniListMediaList[];
    };
  };
}
