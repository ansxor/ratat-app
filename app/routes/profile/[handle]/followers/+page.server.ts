import { loadFollowListPage } from "$lib/follow-list-page.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) =>
  loadFollowListPage("followers", params.handle, url);
