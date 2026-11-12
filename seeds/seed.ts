import { seed } from "$hatk";

const { createAccount, createRecord, uploadBlob } = seed();

const alice = await createAccount("alice.test");
const bob = await createAccount("bob.test");
const carol = await createAccount("carol.test");

const now = Date.now();
const ago = (minutes: number, offsetSeconds = 0) =>
  new Date(now - minutes * 60_000 - offsetSeconds * 1000).toISOString();

const TID_CHARS = "234567abcdefghijklmnopqrstuvwxyz";
const TID_BASE_US = 1_700_000_000_000_000n;

function makeTid(minutesAgo: number, clockId: number): string {
  const us = TID_BASE_US - BigInt(minutesAgo) * 60_000_000n;
  let val = (us << 10n) | BigInt(clockId & 0x3ff);
  let out = "";
  for (let i = 0; i < 13; i++) {
    out = TID_CHARS[Number(val & 31n)] + out;
    val >>= 5n;
  }
  return out;
}

const [aliceAvatar, aliceArt1, aliceArt2, aliceArt3, bobAvatar, bobArt1, bobArt2, bobArt3] =
  await Promise.all([
    uploadBlob(alice, "./seeds/images/avatar-alice.png"),
    uploadBlob(alice, "./seeds/images/art-1.png"),
    uploadBlob(alice, "./seeds/images/art-2.png"),
    uploadBlob(alice, "./seeds/images/art-3.png"),
    uploadBlob(bob, "./seeds/images/avatar-bob.png"),
    uploadBlob(bob, "./seeds/images/art-1.png"),
    uploadBlob(bob, "./seeds/images/art-2.png"),
    uploadBlob(bob, "./seeds/images/art-3.png"),
  ]);

await createRecord(
  alice,
  "app.bsky.actor.profile",
  {
    displayName: "Alice",
    description: "Digital illustrator exploring warm color palettes and landscapes.",
    avatar: aliceAvatar,
    banner: aliceArt3,
  },
  { rkey: "self" },
);

await createRecord(
  bob,
  "app.bsky.actor.profile",
  {
    displayName: "Bob",
    description:
      "Character designer and nocturnal sketch artist. Posting studies, multi-panel pieces, and mature figure work.",
    avatar: bobAvatar,
    banner: bobArt1,
  },
  { rkey: "self" },
);

await createRecord(
  carol,
  "app.bsky.actor.profile",
  {
    displayName: "Carol",
    description: "Art collector and curator following independent artists.",
  },
  { rkey: "self" },
);

type MediaSpec = {
  blob: typeof aliceArt1;
  alt: string;
  aspectRatio: { width: number; height: number };
};

const aliceSpecs: MediaSpec[] = [
  {
    blob: aliceArt1,
    alt: "Warm horizon landscape study",
    aspectRatio: { width: 256, height: 192 },
  },
  { blob: aliceArt2, alt: "Nocturnal moonlit clearing", aspectRatio: { width: 192, height: 256 } },
  {
    blob: aliceArt3,
    alt: "Geometric diagonal color study",
    aspectRatio: { width: 200, height: 200 },
  },
];

const alicePosts: Array<{
  clockId: number;
  text: string;
  minutesAgo: number;
  images: MediaSpec[];
  label?: string;
}> = [
  {
    clockId: 1,
    text: "Four-panel color progression from golden hour to midnight.",
    minutesAgo: 2,
    images: [aliceSpecs[0], aliceSpecs[1], aliceSpecs[2], aliceSpecs[0]],
  },
  {
    clockId: 2,
    text: "Sunset study on textured paper.",
    minutesAgo: 12,
    images: [aliceSpecs[0]],
  },
  {
    clockId: 3,
    text: "Figure study (adult).",
    minutesAgo: 22,
    images: [aliceSpecs[1]],
    label: "porn",
  },
  {
    clockId: 4,
    text: "High-contrast anatomy sketch (graphic media).",
    minutesAgo: 32,
    images: [aliceSpecs[2]],
    label: "graphic-media",
  },
  {
    clockId: 5,
    text: "Intimate portrait lighting study.",
    minutesAgo: 42,
    images: [aliceSpecs[0]],
    label: "sexual",
  },
  {
    clockId: 6,
    text: "Midnight moon study.",
    minutesAgo: 52,
    images: [aliceSpecs[1]],
  },
  {
    clockId: 7,
    text: "Diagonal palette tile.",
    minutesAgo: 62,
    images: [aliceSpecs[2]],
  },
  {
    clockId: 8,
    text: "Early afternoon horizon sketch.",
    minutesAgo: 72,
    images: [aliceSpecs[0]],
  },
];

const aliceCreated: Array<{ uri: string; cid: string }> = [];
for (const item of alicePosts) {
  const res = await createRecord(
    alice,
    "app.bsky.feed.post",
    {
      text: item.text,
      createdAt: ago(item.minutesAgo, 30),
      embed: {
        $type: "app.bsky.embed.images",
        images: item.images.map((img) => ({
          image: img.blob,
          alt: img.alt,
          aspectRatio: img.aspectRatio,
        })),
      },
      ...(item.label
        ? {
            labels: {
              $type: "com.atproto.label.defs#selfLabels",
              values: [{ val: item.label }],
            },
          }
        : {}),
    },
    { rkey: makeTid(item.minutesAgo, item.clockId) },
  );
  aliceCreated.push({ uri: res.uri, cid: res.cid });
}

await createRecord(
  alice,
  "app.bsky.feed.post",
  {
    text: "Quick studio update without any attached artwork.",
    createdAt: ago(5, 30),
  },
  { rkey: makeTid(5, 9) },
);

const bobSpecs: MediaSpec[] = [
  { blob: bobArt1, alt: "Bob sunset horizon painting", aspectRatio: { width: 256, height: 192 } },
  { blob: bobArt2, alt: "Bob moonlit nocturnal study", aspectRatio: { width: 192, height: 256 } },
  { blob: bobArt3, alt: "Bob geometric pattern study", aspectRatio: { width: 200, height: 200 } },
];

const bobCreated: Array<{ rkey: string; uri: string; cid: string }> = [];
for (let i = 65; i >= 1; i--) {
  const minutesAgo = 66 - i;
  const rkey = makeTid(minutesAgo, i);
  const spec = bobSpecs[i % bobSpecs.length];
  const isCarousel = i === 65 || i % 5 === 0;
  const images = isCarousel ? [bobSpecs[0], bobSpecs[1], bobSpecs[2], bobSpecs[0]] : [spec];

  let label: string | undefined;
  if (i === 64 || (i < 60 && i % 11 === 0)) label = "porn";
  else if (i === 63 || (i < 60 && i % 13 === 0)) label = "graphic-media";
  else if (i === 62) label = "sexual";

  const text = isCarousel
    ? `Artwork series #${i} — four-image carousel study.`
    : label
      ? `Artwork #${i} (${label} rated study).`
      : `Artwork #${i} — nocturnal color sketch.`;

  const res = await createRecord(
    bob,
    "app.bsky.feed.post",
    {
      text,
      createdAt: ago(minutesAgo),
      embed: {
        $type: "app.bsky.embed.images",
        images: images.map((img) => ({
          image: img.blob,
          alt: img.alt,
          aspectRatio: img.aspectRatio,
        })),
      },
      ...(label
        ? {
            labels: {
              $type: "com.atproto.label.defs#selfLabels",
              values: [{ val: label }],
            },
          }
        : {}),
    },
    { rkey },
  );
  bobCreated.push({ rkey, uri: res.uri, cid: res.cid });
}

await createRecord(
  bob,
  "app.bsky.feed.post",
  {
    text: "Text-only note: taking commissions next week.",
    createdAt: ago(3, 15),
  },
  { rkey: makeTid(3, 66) },
);

await createRecord(
  bob,
  "app.bsky.feed.post",
  {
    text: "Another text-only thread post with no media.",
    createdAt: ago(20, 15),
  },
  { rkey: makeTid(20, 67) },
);

await createRecord(
  carol,
  "net.ratat.graph.follow",
  { subject: alice.did, createdAt: ago(120) },
  { rkey: makeTid(120, 1) },
);

await createRecord(
  carol,
  "net.ratat.graph.follow",
  { subject: bob.did, createdAt: ago(110) },
  { rkey: makeTid(110, 2) },
);

await createRecord(
  alice,
  "net.ratat.graph.follow",
  { subject: bob.did, createdAt: ago(100) },
  { rkey: makeTid(100, 3) },
);

if (bobCreated[0]) {
  await createRecord(
    carol,
    "app.bsky.feed.like",
    { subject: { uri: bobCreated[0].uri, cid: bobCreated[0].cid }, createdAt: ago(1) },
    { rkey: makeTid(1, 1) },
  );
  await createRecord(
    alice,
    "app.bsky.feed.like",
    { subject: { uri: bobCreated[0].uri, cid: bobCreated[0].cid }, createdAt: ago(1, 10) },
    { rkey: makeTid(1, 2) },
  );
}

if (bobCreated[1]) {
  await createRecord(
    carol,
    "app.bsky.feed.like",
    { subject: { uri: bobCreated[1].uri, cid: bobCreated[1].cid }, createdAt: ago(2) },
    { rkey: makeTid(2, 3) },
  );
}

if (aliceCreated[0]) {
  await createRecord(
    carol,
    "app.bsky.feed.like",
    { subject: aliceCreated[0], createdAt: ago(3) },
    { rkey: makeTid(3, 4) },
  );
}

console.log("\n[seed] Done!");
