import { describe, expect, it } from "vitest";
import {
  AtUri,
  BSKY_CDN_URL,
  BSKY_VIDEO_URL,
  BSKY_WEB_URL,
  Blobs,
  applyHatkLabels,
  blobCid,
  bskyPostUrl,
  bskyProfileUrl,
  labelValues,
  mediaFromEmbedView,
  mediaFromRecordEmbed,
  selfLabelValues,
  storedLabels,
  toIsoString,
  withHatkLabels,
} from "../../server/_atproto.ts";

describe("AtUri", () => {
  it("parses valid post and like URIs", () => {
    const post = AtUri.parse("at://did:plc:artist1/app.bsky.feed.post/3k2a1b");
    expect(post).toEqual({
      repo: "did:plc:artist1",
      collection: "app.bsky.feed.post",
      rkey: "3k2a1b",
    });

    const like = AtUri.parse("at://did:plc:fan1/app.bsky.feed.like/9x8y7z");
    expect(like?.repo).toBe("did:plc:fan1");
    expect(like?.collection).toBe("app.bsky.feed.like");
    expect(like?.rkey).toBe("9x8y7z");
  });

  it("rejects malformed URIs", () => {
    expect(AtUri.parse("")).toBeUndefined();
    expect(AtUri.parse("https://bsky.app/profile/a/post/b")).toBeUndefined();
    expect(AtUri.parse("at://did:plc:artist1/app.bsky.feed.post")).toBeUndefined();
    expect(AtUri.parse("at://did:plc:artist1/app.bsky.feed.post/rkey/extra")).toBeUndefined();
    expect(AtUri.parse("at:///app.bsky.feed.post/rkey")).toBeUndefined();
  });

  it("builds post AT URIs", () => {
    expect(AtUri.post("did:plc:artist1", "abc123")).toBe(
      "at://did:plc:artist1/app.bsky.feed.post/abc123",
    );
  });
});

describe("Blobs", () => {
  const did = "did:plc:artist1";
  const cid = "bafkreiabcdefgh";

  it("uses local resolver URLs when provided", () => {
    const blobs = new Blobs((d, _ref, preset) => `/blob/${d}/${cid}?preset=${preset}`);
    expect(blobs.image(did, cid, "feed_thumbnail")).toBe(
      `/blob/${did}/${cid}?preset=feed_thumbnail`,
    );
    expect(blobs.videoPlaylist(did, cid)).toBe(`/blob/${did}/${cid}?preset=feed_fullsize`);
    expect(blobs.videoThumbnail(did, cid)).toBe(`/blob/${did}/${cid}?preset=feed_thumbnail`);
  });

  it("falls back to prod CDN and video hosts when resolver is omitted or non-local", () => {
    const prod = new Blobs();
    expect(prod.image(did, cid, "avatar")).toBe(
      `${BSKY_CDN_URL}/img/avatar/plain/${did}/${cid}@jpeg`,
    );
    expect(prod.videoPlaylist(did, cid)).toBe(
      `${BSKY_VIDEO_URL}/watch/${encodeURIComponent(did)}/${encodeURIComponent(cid)}/playlist.m3u8`,
    );
    expect(prod.videoThumbnail(did, cid)).toBe(
      `${BSKY_VIDEO_URL}/watch/${encodeURIComponent(did)}/${encodeURIComponent(cid)}/thumbnail.jpg`,
    );

    const custom = new Blobs((d, _ref, preset) => `https://cdn.example/${preset}/${d}/${cid}`);
    expect(custom.image(did, cid, "banner")).toBe(`https://cdn.example/banner/${did}/${cid}`);
    expect(custom.videoPlaylist(did, cid)).toBe(
      `${BSKY_VIDEO_URL}/watch/${encodeURIComponent(did)}/${encodeURIComponent(cid)}/playlist.m3u8`,
    );
  });

  it("resolves stored avatars/banners from refs, safe URLs, and rejects protocol-relative paths", () => {
    const blobs = new Blobs((d, _ref, preset) => `/blob/${d}/${preset}`);
    expect(blobs.stored(did, { ref: { $link: cid } }, "avatar")).toBe(`/blob/${did}/avatar`);
    expect(blobs.stored(did, JSON.stringify({ ref: { $link: cid } }), "banner")).toBe(
      `/blob/${did}/banner`,
    );
    expect(blobs.stored(did, "https://cdn.bsky.app/img/avatar.jpg", "avatar")).toBe(
      "https://cdn.bsky.app/img/avatar.jpg",
    );
    expect(blobs.stored(did, "/blob/local-avatar.png", "avatar")).toBe("/blob/local-avatar.png");
    expect(blobs.stored(did, "//evil.example/payload.png", "avatar")).toBeUndefined();
    expect(blobs.stored(did, null, "avatar")).toBeUndefined();
  });
});

describe("URL & value helpers", () => {
  it("extracts blob CIDs and formats URLs and ISO dates", () => {
    expect(blobCid({ ref: { $link: "bafkrei123" } })).toBe("bafkrei123");
    expect(blobCid({ ref: { toString: () => "bafybeicustom" } })).toBe("bafybeicustom");
    expect(blobCid({ ref: { $link: "" } })).toBeUndefined();
    expect(blobCid("not-json")).toBeUndefined();

    expect(bskyProfileUrl("alice.bsky.social")).toBe(`${BSKY_WEB_URL}/profile/alice.bsky.social`);
    expect(bskyPostUrl("did:plc:a", "at://did:plc:a/app.bsky.feed.post/3k1")).toBe(
      `${BSKY_WEB_URL}/profile/did:plc:a/post/3k1`,
    );
    expect(bskyPostUrl("did:plc:a", "bad-uri")).toBeUndefined();

    const date = new Date("2026-01-02T03:04:05.000Z");
    expect(toIsoString(date)).toBe("2026-01-02T03:04:05.000Z");
    expect(toIsoString("2026-01-02T03:04:05Z")).toBe("2026-01-02T03:04:05Z");
    expect(toIsoString("")).toBeUndefined();
    expect(toIsoString(null)).toBeUndefined();
  });
});

describe("label extraction", () => {
  it("applies and negates labelValues", () => {
    expect(
      labelValues([{ val: "nsfw" }, { val: "nudity" }, { val: "nsfw", neg: true }, { val: "" }]),
    ).toEqual(["nudity"]);
    expect(labelValues(undefined)).toEqual([]);
  });

  it("extracts deduplicated selfLabelValues", () => {
    expect(
      selfLabelValues({
        labels: {
          $type: "com.atproto.label.defs#selfLabels",
          values: [{ val: "nudity" }, { val: "nudity" }, { val: "gore" }],
        },
      }),
    ).toEqual(["nudity", "gore"]);
    expect(selfLabelValues({ labels: { $type: "other", values: [{ val: "x" }] } })).toEqual([]);
  });

  it("reads storedLabels from strings, arrays, and selfLabels objects", () => {
    expect(storedLabels(["a", "", "b"])).toEqual(["a", "b"]);
    expect(storedLabels([{ val: "a" }, { val: "b" }, { val: "a", neg: true }])).toEqual(["b"]);
    expect(storedLabels(JSON.stringify(["nsfw"]))).toEqual(["nsfw"]);
    expect(
      storedLabels(
        JSON.stringify({
          $type: "com.atproto.label.defs#selfLabels",
          values: [{ val: "sexual" }],
        }),
      ),
    ).toEqual(["sexual"]);
    expect(storedLabels("{bad json")).toEqual([]);
  });

  it("merges hatk labels additively for posts and with negation for profiles", () => {
    expect(withHatkLabels(["nudity"], [{ val: "spam" }, { val: "nudity", neg: true }])).toEqual([
      "nudity",
      "spam",
    ]);

    expect(
      applyHatkLabels(["nudity", "spam"], [{ val: "nudity", neg: true }, { val: "verified" }]),
    ).toEqual(["spam", "verified"]);
  });
});

describe("media extraction", () => {
  const blobs = new Blobs();

  it("extracts images, videos, and recordWithMedia from appview embed views", () => {
    expect(
      mediaFromEmbedView({
        $type: "app.bsky.embed.images#view",
        images: [
          {
            thumb: "https://cdn/t.jpg",
            fullsize: "https://cdn/f.jpg",
            alt: "sketch",
            aspectRatio: { width: 800, height: 600 },
          },
          { thumb: "", fullsize: "https://cdn/missing.jpg" },
        ],
      }),
    ).toEqual([
      {
        $type: "net.ratat.feed.defs#imageView",
        thumb: "https://cdn/t.jpg",
        fullsize: "https://cdn/f.jpg",
        alt: "sketch",
        aspectRatio: { width: 800, height: 600 },
      },
    ]);

    expect(
      mediaFromEmbedView({
        $type: "app.bsky.embed.recordWithMedia#view",
        media: {
          $type: "app.bsky.embed.video#view",
          playlist: "https://video/p.m3u8",
          thumbnail: "https://video/t.jpg",
        },
      }),
    ).toEqual([
      {
        $type: "net.ratat.feed.defs#videoView",
        playlist: "https://video/p.m3u8",
        thumbnail: "https://video/t.jpg",
      },
    ]);
  });

  it("extracts images, videos, and recordWithMedia from stored record embeds", () => {
    const did = "did:plc:artist1";
    const imgCid = "bafkreiimg1";
    const vidCid = "bafkreivid1";

    expect(
      mediaFromRecordEmbed(
        did,
        {
          $type: "app.bsky.embed.images",
          images: [{ image: { ref: { $link: imgCid } }, alt: "ink" }],
        },
        blobs,
      ),
    ).toEqual([
      {
        $type: "net.ratat.feed.defs#imageView",
        thumb: blobs.image(did, imgCid, "feed_thumbnail"),
        fullsize: blobs.image(did, imgCid, "feed_fullsize"),
        alt: "ink",
      },
    ]);

    expect(
      mediaFromRecordEmbed(
        did,
        JSON.stringify({
          $type: "app.bsky.embed.recordWithMedia",
          media: {
            $type: "app.bsky.embed.video",
            video: { ref: { $link: vidCid } },
            aspectRatio: { width: 16, height: 9 },
          },
        }),
        blobs,
      ),
    ).toEqual([
      {
        $type: "net.ratat.feed.defs#videoView",
        playlist: blobs.videoPlaylist(did, vidCid),
        thumbnail: blobs.videoThumbnail(did, vidCid),
        aspectRatio: { width: 16, height: 9 },
      },
    ]);
  });
});
