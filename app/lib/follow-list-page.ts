import { paginationSearch } from "$lib/pagination.ts";
import {
  type FollowListResult,
  getFollowList,
  getProfile,
  type Profile,
  readFailureMessage,
} from "$lib/ratat.ts";

export const FOLLOW_LIST_PAGE_SIZE = 30;

export type FollowListKind = "followers" | "following";

export interface FollowListPageData {
  handle: string;
  requestedPage: number;
  profile: Profile | null;
  list: FollowListResult | null;
  errorMessage: string | null;
}

export async function loadFollowListPage(
  kind: FollowListKind,
  handle: string,
  url: URL,
): Promise<FollowListPageData> {
  const requestedPage = paginationSearch(url.searchParams).page ?? 1;

  try {
    const [profile, list] = await Promise.all([
      getProfile(handle),
      getFollowList(kind, handle, { page: requestedPage, limit: FOLLOW_LIST_PAGE_SIZE }),
    ]);
    return {
      handle,
      requestedPage,
      profile,
      list,
      errorMessage: null,
    };
  } catch (cause) {
    return {
      handle,
      requestedPage,
      profile: null,
      list: null,
      errorMessage: readFailureMessage(cause, "No such account on Bluesky."),
    };
  }
}
