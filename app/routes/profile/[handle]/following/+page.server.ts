import { loadFollowListPage } from "$lib/follow-list-page.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) =>
  loadFollowListPage("following", params.handle, url);
