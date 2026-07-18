export interface KitsuFavoriteItem {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  type: "anime" | "manga" | "character" | "person";
}

export interface KitsuUserProfile {
  slug: string;
  name: string;
  about: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  birthday: string | null;
  createdAt: string;
  gender: string | null;
  location: string | null;
  website: string | null;
  waifu: {
    slug: string;
    name: string;
    imageUrl: string | null;
    label: string;
  } | null;
  stats: {
    animeTimeSecs: number | null;
    animeSeries: number | null;
    animeEpisodes: number | null;
    mangaSeries: number | null;
    mangaChapters: number | null;
  };
  favorites: {
    anime: KitsuFavoriteItem[];
    manga: KitsuFavoriteItem[];
    character: KitsuFavoriteItem[];
    person: KitsuFavoriteItem[];
  };
}

export function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days} day${days !== 1 ? "s" : ""}`;
  const years = Math.floor(days / 365);
  const rem = days % 365;
  return rem > 0
    ? `${years} yr${years !== 1 ? "s" : ""} ${rem} day${rem !== 1 ? "s" : ""}`
    : `${years} yr${years !== 1 ? "s" : ""}`;
}

export function formatProfileDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatElapsedSince(iso: string): string {
  const elapsedMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
  const units = [
    { value: Math.floor(elapsedDays / 365), label: "year" },
    { value: Math.floor(elapsedDays / 30), label: "month" },
    { value: Math.floor(elapsedDays / 7), label: "week" },
    { value: elapsedDays, label: "day" },
    { value: elapsedHours, label: "hour" },
    { value: elapsedMinutes, label: "minute" },
  ];
  const unit = units.find(({ value }) => value > 0);

  if (!unit) return "less than a minute";
  return `${unit.value} ${unit.label}${unit.value === 1 ? "" : "s"}`;
}

export function ageFromBirthday(iso: string): number {
  const bd = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  if (
    now.getMonth() < bd.getMonth() ||
    (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
  )
    age--;
  return age;
}
