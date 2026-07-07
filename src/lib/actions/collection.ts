"use server";

import {
  addAnimeCollectionItem as addAnimeCollectionItemImpl,
  addMangaCollectionItem as addMangaCollectionItemImpl,
  deleteAnimeCollectionItem as deleteAnimeCollectionItemImpl,
  deleteMangaCollectionItem as deleteMangaCollectionItemImpl,
  editAnimeCollectionItem as editAnimeCollectionItemImpl,
  editMangaCollectionItem as editMangaCollectionItemImpl,
  resolveAnimeId as resolveAnimeIdImpl,
  resolveMangaId as resolveMangaIdImpl,
} from "./collection/crud";
import { fetchMangaSeriesDetail as fetchMangaSeriesDetailImpl } from "./collection/details";
import {
  searchAnimeByTitle as searchAnimeByTitleImpl,
  searchMangaByTitle as searchMangaByTitleImpl,
} from "./collection/search";
import type {
  ActionResult,
  AnimeCollectionItemInput,
  KitsuSearchResult,
  MangaCollectionItemInput,
} from "./collection/types";

export type {
  ActionResult,
  AnimeCollectionItemInput,
  KitsuSearchResult,
  MangaCollectionItemInput,
};

export async function searchAnimeByTitle(
  query: string,
): Promise<ActionResult<KitsuSearchResult[]>> {
  return searchAnimeByTitleImpl(query);
}

export async function searchMangaByTitle(
  query: string,
): Promise<ActionResult<KitsuSearchResult[]>> {
  return searchMangaByTitleImpl(query);
}

export async function fetchMangaSeriesDetail(kitsuId: string) {
  return fetchMangaSeriesDetailImpl(kitsuId);
}

export async function addAnimeCollectionItem(
  input: AnimeCollectionItemInput,
): Promise<ActionResult<{ id: string }>> {
  return addAnimeCollectionItemImpl(input);
}

export async function editAnimeCollectionItem(
  id: string,
  input: Omit<AnimeCollectionItemInput, "animeId">,
): Promise<ActionResult> {
  return editAnimeCollectionItemImpl(id, input);
}

export async function deleteAnimeCollectionItem(
  id: string,
): Promise<ActionResult> {
  return deleteAnimeCollectionItemImpl(id);
}

export async function addMangaCollectionItem(
  input: MangaCollectionItemInput,
): Promise<ActionResult<{ id: string }>> {
  return addMangaCollectionItemImpl(input);
}

export async function editMangaCollectionItem(
  id: string,
  input: Omit<MangaCollectionItemInput, "mangaId">,
  totalVolumes: number | null,
  totalChapters: number | null,
): Promise<ActionResult> {
  return editMangaCollectionItemImpl(id, input, totalVolumes, totalChapters);
}

export async function deleteMangaCollectionItem(
  id: string,
): Promise<ActionResult> {
  return deleteMangaCollectionItemImpl(id);
}

export async function resolveAnimeId(
  kitsuId: string,
): Promise<ActionResult<string>> {
  return resolveAnimeIdImpl(kitsuId);
}

export async function resolveMangaId(
  kitsuId: string,
): Promise<ActionResult<string>> {
  return resolveMangaIdImpl(kitsuId);
}
