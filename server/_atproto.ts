export const BSKY_CDN_URL = "https://cdn.bsky.app";
export const BSKY_VIDEO_URL = "https://video.bsky.app";
export const BSKY_WEB_URL = "https://bsky.app";

export type BlobUrlFn = (did: string, ref: unknown, preset?: string) => string | undefined;

export type BlobPreset =
  | "avatar"
  | "avatar_thumbnail"
  | "banner"
  | "feed_thumbnail"
  | "feed_fullsize";

export interface AspectRatio {
  width: number;
  height: number;
}

export interface ImageView {
  $type: "net.ratat.feed.defs#imageView";
  thumb: string;
  fullsize: string;
  alt?: string;
  aspectRatio?: AspectRatio;
}

export interface VideoView {
  $type: "net.ratat.feed.defs#videoView";
  playlist: string;
  thumbnail?: string;
  alt?: string;
  aspectRatio?: AspectRatio;
}

export type MediaView = ImageView | VideoView;

export class AtUri {
  readonly repo: string;
  readonly collection: string;
  readonly rkey: string;

  constructor(repo: string, collection: string, rkey: string) {
    this.repo = repo;
    this.collection = collection;
    this.rkey = rkey;
  }

  static parse(uri: string): AtUri | undefined {
    const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
    if (!match) return undefined;
    const [, repo, collection, rkey] = match;
    if (!repo || !collection || !rkey) return undefined;
    return new AtUri(repo, collection, rkey);
  }

  static post(did: string, rkey: string): string {
    return `at://${did}/app.bsky.feed.post/${rkey}`;
  }
}

export class Blobs {
  private readonly resolve?: BlobUrlFn;

  constructor(resolve?: BlobUrlFn) {
    this.resolve = resolve;
  }

  image(did: string, cid: string, preset: BlobPreset): string {
    const url = this.resolve?.(did, { ref: { $link: cid } }, preset);
    if (url) return url;
    return `${BSKY_CDN_URL}/img/${preset}/plain/${did}/${cid}@jpeg`;
  }

  videoPlaylist(did: string, cid: string): string {
    const url = this.resolve?.(did, { ref: { $link: cid } }, "feed_fullsize");
    if (url?.startsWith("/blob/")) {
      return url;
    }
    return `${BSKY_VIDEO_URL}/watch/${encodeURIComponent(did)}/${encodeURIComponent(cid)}/playlist.m3u8`;
  }

  videoThumbnail(did: string, cid: string): string {
    const url = this.resolve?.(did, { ref: { $link: cid } }, "feed_thumbnail");
    if (url?.startsWith("/blob/")) {
      return url;
    }
    return `${BSKY_VIDEO_URL}/watch/${encodeURIComponent(did)}/${encodeURIComponent(cid)}/thumbnail.jpg`;
  }

  stored(did: string, value: unknown, preset: "avatar" | "banner"): string | undefined {
    if (typeof value === "string") {
      if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        (value.startsWith("/") && !value.startsWith("//"))
      ) {
        return value;
      }
    }
    const cid = blobCid(value);
    return cid ? this.image(did, cid, preset) : undefined;
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const aspectRatioOf = (value: unknown): AspectRatio | undefined => {
  const ratio = asRecord(value);
  if (!ratio) return undefined;
  const { width, height } = ratio;
  if (typeof width !== "number" || typeof height !== "number") return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return { width, height };
};

export function blobCid(value: unknown): string | undefined {
  const obj = asRecord(value);
  if (!obj) return undefined;
  const ref = obj.ref;
  if (typeof ref !== "object" || ref === null) return undefined;
  if ("$link" in ref && typeof ref.$link === "string" && ref.$link.length > 0) {
    return ref.$link;
  }
  if ("toString" in ref && typeof ref.toString === "function") {
    const text = String(ref);
    if (text.startsWith("baf")) return text;
  }
  return undefined;
}

export function bskyProfileUrl(actor: string): string {
  return `${BSKY_WEB_URL}/profile/${actor}`;
}

export function bskyPostUrl(authorDid: string, postUri: string): string | undefined {
  const parsed = AtUri.parse(postUri);
  if (!parsed) return undefined;
  return `${BSKY_WEB_URL}/profile/${authorDid}/post/${parsed.rkey}`;
}

export function toIsoString(value: string | Date | null | undefined): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

export function labelValues(
  labels: readonly { val: string; neg?: boolean }[] | undefined,
): string[] {
  if (!labels || labels.length === 0) return [];
  const applied = new Set<string>();
  for (const label of labels) {
    if (!label.val) continue;
    if (label.neg) applied.delete(label.val);
    else applied.add(label.val);
  }
  return [...applied];
}

export function selfLabelValues(record: unknown): string[] {
  const rec = asRecord(record);
  const labels = asRecord(rec?.labels);
  if (labels?.$type !== "com.atproto.label.defs#selfLabels") return [];

  const values = labels.values;
  if (!Array.isArray(values)) return [];

  const out: string[] = [];
  for (const entry of values) {
    const val = asString(asRecord(entry)?.val);
    if (val && !out.includes(val)) out.push(val);
  }
  return out;
}

export function storedLabels(labels: unknown): string[] {
  if (!labels) return [];
  if (Array.isArray(labels)) {
    if (labels.length === 0) return [];
    if (typeof labels[0] === "string") {
      return labels.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
    return labelValues(labels as readonly { val: string; neg?: boolean }[]);
  }
  if (typeof labels === "string") {
    try {
      const parsed: unknown = JSON.parse(labels);
      if (Array.isArray(parsed)) return storedLabels(parsed);
      return selfLabelValues({ labels: parsed });
    } catch {
      return [];
    }
  }
  if (typeof labels === "object") {
    return selfLabelValues({ labels });
  }
  return [];
}

export function withHatkLabels(base: readonly string[], entries: unknown): string[] {
  if (!Array.isArray(entries)) return [...base];
  const added: string[] = [];
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as { val?: unknown; neg?: unknown };
    if (typeof entry.val === "string" && entry.val.length > 0 && !entry.neg) {
      added.push(entry.val);
    }
  }
  if (added.length === 0) return [...base];
  return [...new Set([...base, ...added])];
}

export function applyHatkLabels(base: readonly string[], entries: unknown): string[] {
  const set = new Set<string>(base);
  if (!Array.isArray(entries)) return [...set];
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as { val?: unknown; neg?: unknown };
    if (typeof entry.val !== "string" || entry.val.length === 0) continue;
    if (entry.neg) set.delete(entry.val);
    else set.add(entry.val);
  }
  return [...set];
}

export function mediaFromEmbedView(embed: unknown): MediaView[] {
  const obj = asRecord(embed);
  if (!obj) return [];

  switch (obj.$type) {
    case "app.bsky.embed.images#view": {
      const images = obj.images;
      if (!Array.isArray(images)) return [];
      const out: MediaView[] = [];
      for (const raw of images) {
        const img = asRecord(raw);
        if (!img) continue;
        const thumb = asString(img.thumb);
        const fullsize = asString(img.fullsize);
        if (!thumb || !fullsize) continue;
        const alt = asString(img.alt);
        const aspectRatio = aspectRatioOf(img.aspectRatio);
        out.push({
          $type: "net.ratat.feed.defs#imageView",
          thumb,
          fullsize,
          ...(alt ? { alt } : {}),
          ...(aspectRatio ? { aspectRatio } : {}),
        });
      }
      return out;
    }
    case "app.bsky.embed.video#view": {
      const playlist = asString(obj.playlist);
      if (!playlist) return [];
      const thumbnail = asString(obj.thumbnail);
      const alt = asString(obj.alt);
      const aspectRatio = aspectRatioOf(obj.aspectRatio);
      return [
        {
          $type: "net.ratat.feed.defs#videoView",
          playlist,
          ...(thumbnail ? { thumbnail } : {}),
          ...(alt ? { alt } : {}),
          ...(aspectRatio ? { aspectRatio } : {}),
        },
      ];
    }
    case "app.bsky.embed.recordWithMedia#view":
      return mediaFromEmbedView(obj.media);
    default:
      return [];
  }
}

const imageFromRecord = (did: string, value: unknown, blobs: Blobs): MediaView | undefined => {
  const entry = asRecord(value);
  if (!entry) return undefined;
  const cid = blobCid(entry.image);
  if (!cid) return undefined;
  const alt = asString(entry.alt);
  const aspectRatio = aspectRatioOf(entry.aspectRatio);
  return {
    $type: "net.ratat.feed.defs#imageView",
    thumb: blobs.image(did, cid, "feed_thumbnail"),
    fullsize: blobs.image(did, cid, "feed_fullsize"),
    ...(alt ? { alt } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
  };
};

const videoFromRecord = (
  did: string,
  embed: Record<string, unknown>,
  blobs: Blobs,
): MediaView | undefined => {
  const cid = blobCid(embed.video);
  if (!cid) return undefined;
  const alt = asString(embed.alt);
  const aspectRatio = aspectRatioOf(embed.aspectRatio);
  return {
    $type: "net.ratat.feed.defs#videoView",
    playlist: blobs.videoPlaylist(did, cid),
    thumbnail: blobs.videoThumbnail(did, cid),
    ...(alt ? { alt } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
  };
};

export function mediaFromRecordEmbed(did: string, value: unknown, blobs: Blobs): MediaView[] {
  const embed = asRecord(value);
  switch (embed?.$type) {
    case "app.bsky.embed.images": {
      const images = embed.images;
      if (!Array.isArray(images)) return [];
      return images
        .map((image) => imageFromRecord(did, image, blobs))
        .filter((media): media is MediaView => media !== undefined);
    }
    case "app.bsky.embed.video": {
      const video = videoFromRecord(did, embed, blobs);
      return video ? [video] : [];
    }
    case "app.bsky.embed.recordWithMedia":
      return mediaFromRecordEmbed(did, embed.media, blobs);
    default:
      return [];
  }
}
