"use server";

import {
  loginKitsuAction as loginKitsuActionImpl,
  logoutAndRedirectAction as logoutAndRedirectActionImpl,
  logoutAppAction as logoutAppActionImpl,
} from "./actions/auth";
import {
  deleteInvalidEntriesAction as deleteInvalidEntriesActionImpl,
  findInvalidEntriesAction as findInvalidEntriesActionImpl,
  getSyncStatusAction as getSyncStatusActionImpl,
  normalizeInvalidRatingsAction as normalizeInvalidRatingsActionImpl,
  triggerSyncAction as triggerSyncActionImpl,
} from "./actions/sync";
import type { SyncDirection, SyncProvider } from "./actions/types";

export async function loginKitsuAction(formData: FormData) {
  return loginKitsuActionImpl(formData);
}

export async function logoutAndRedirectAction(provider: SyncProvider) {
  return logoutAndRedirectActionImpl(provider);
}

export async function logoutAppAction() {
  return logoutAppActionImpl();
}

export async function triggerSyncAction(
  provider: SyncProvider,
  direction: SyncDirection,
) {
  return triggerSyncActionImpl(provider, direction);
}

export async function getSyncStatusAction() {
  return getSyncStatusActionImpl();
}

export async function findInvalidEntriesAction() {
  return findInvalidEntriesActionImpl();
}

export async function deleteInvalidEntriesAction(
  animeIds: string[],
  mangaIds: string[],
) {
  return deleteInvalidEntriesActionImpl(animeIds, mangaIds);
}

export async function normalizeInvalidRatingsAction() {
  return normalizeInvalidRatingsActionImpl();
}
