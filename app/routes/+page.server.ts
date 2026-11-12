import { paginationSearch } from "$lib/pagination.ts";
import { getTimeline, hasRatatFollows } from "$lib/ratat.ts";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 30;

export const load: PageServerLoad = async ({ parent, url }) => {
  const { viewer } = await parent();
  if (!viewer) {
    return {
      page: 1,
      timeline: null,
      hasFollows: false,
      errorMessage: null,
    };
  }

  const page = paginationSearch(url.searchParams).page ?? 1;

  try {
    const [timeline, hasFollows] = await Promise.all([
      getTimeline(viewer.did, { page, limit: PAGE_SIZE }),
      hasRatatFollows(viewer.did),
    ]);
    return {
      page: timeline.page,
      timeline,
      hasFollows,
      errorMessage: null,
    };
  } catch {
    return {
      page,
      timeline: null,
      hasFollows: true,
      errorMessage: "Couldn't load your feed right now. Try again in a moment.",
    };
  }
};
