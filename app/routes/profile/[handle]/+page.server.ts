import { paginationSearch } from "$lib/pagination.ts";
import { getAuthorFeed, getProfile, readFailureMessage } from "$lib/ratat.ts";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 30;
const MAX_PAGE = 100;

export const load: PageServerLoad = async ({ params, url }) => {
  const validated = paginationSearch(url.searchParams);
  const requestedPage = validated.page === undefined ? 1 : Math.min(validated.page, MAX_PAGE);

  try {
    const profile = await getProfile(params.handle);
    const portfolio = await getAuthorFeed(profile.did, {
      page: requestedPage,
      limit: PAGE_SIZE,
    });
    return {
      handle: params.handle,
      requestedPage,
      profile,
      portfolio,
      errorMessage: null,
    };
  } catch (cause) {
    return {
      handle: params.handle,
      requestedPage,
      profile: null,
      portfolio: null,
      errorMessage: readFailureMessage(cause, "No such account on Bluesky."),
    };
  }
};
