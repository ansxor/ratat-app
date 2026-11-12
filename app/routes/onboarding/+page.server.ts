import { redirect } from "@sveltejs/kit";
import { parseViewer } from "$hatk/client";
import { hasRatatFollows, listBskyFollows } from "$lib/ratat.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, parent }) => {
  const { viewer } = await parent();
  const activeViewer = viewer ?? (await parseViewer(cookies));
  if (!activeViewer) {
    redirect(302, "/login");
  }

  const hasFollows = await hasRatatFollows(activeViewer.did).catch(() => false);
  if (hasFollows) {
    redirect(302, "/");
  }

  const candidates = await listBskyFollows(activeViewer.did);
  return {
    viewer: activeViewer,
    candidates,
  };
};
