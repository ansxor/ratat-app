import { parseViewer } from "$hatk/client";
import { getAuthorFeed, getPost, readFailureMessage, type Post } from "$lib/ratat";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, cookies, parent }) => {
  const { viewer } = await parent();
  const activeViewer = viewer ?? (await parseViewer(cookies));

  let post: Post | null = null;
  let errorMessage: string | null = null;

  try {
    post = await getPost(params.handle, params.rkey, { viewer: activeViewer?.did });
  } catch (cause) {
    errorMessage = readFailureMessage(cause, "That artwork isn't on Ratat.");
  }

  if (!post) {
    return {
      post: null,
      errorMessage: errorMessage ?? "That artwork isn't on Ratat.",
      moreBy: [] as Post[],
      handle: params.handle,
      rkey: params.rkey,
    };
  }

  const feed = await getAuthorFeed(post.author.did, { sample: true, limit: 9 }).catch(
    () => undefined,
  );
  const moreBy = (feed?.posts ?? []).filter((other) => other.uri !== post.uri).slice(0, 8);

  return {
    post,
    errorMessage: null,
    moreBy,
    handle: params.handle,
    rkey: params.rkey,
  };
};
