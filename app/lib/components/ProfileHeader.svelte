<script module lang="ts">
  export type ProfileSection = "art" | "following" | "followers";
</script>

<script lang="ts">
  import { untrack } from "svelte";

  import ArtworkVeil from "$lib/components/ArtworkVeil.svelte";
  import ExpandableText from "$lib/components/ExpandableText.svelte";
  import FollowButton from "$lib/components/FollowButton.svelte";
  import { followsStore } from "$lib/follows.svelte.ts";
  import type { Profile } from "$lib/ratat.ts";
  import { useContentVeil } from "$lib/settings.svelte.ts";
  import { cn } from "$lib/utils.ts";

  const STAT_LINK =
    "flex flex-col gap-[2px] items-start no-underline max-mobile:inline max-mobile:font-bold max-mobile:text-[14px]";
  const STAT_VALUE =
    "font-display text-[22px] font-[500] leading-none max-mobile:font-bold max-mobile:text-[14px]";
  const STAT_LABEL =
    "font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint max-mobile:text-[12px] max-mobile:normal-case max-mobile:tracking-normal";

  const BSKY_FAVICON = "https://www.google.com/s2/favicons?domain=bsky.app&sz=64";

  let {
    profile,
    artCount,
    section = "art",
  }: {
    profile: Profile;
    artCount: number;
    section?: ProfileSection;
  } = $props();

  const contentVeil = useContentVeil(() => profile.labels);

  let faviconFailedFor = $state<string | undefined>(undefined);

  $effect(() => {
    const _url = profile.bskyUrl;
    untrack(() => {
      if (faviconFailedFor !== undefined && faviconFailedFor !== _url) {
        faviconFailedFor = undefined;
      }
    });
  });

  const cover = $derived(contentVeil.hidden ? ("black" as const) : contentVeil.veil);
  const covered = $derived(cover !== null && !contentVeil.peeked);
  const name = $derived(profile.displayName?.trim() || profile.handle);
  const bannerBg = $derived(
    profile.banner ? `url(${profile.banner})` : "var(--fixed-avatar-placeholder)",
  );
  const avatarBg = $derived(
    profile.avatar ? `url(${profile.avatar})` : "var(--fixed-avatar-placeholder)",
  );
  const blur = $derived(covered && cover === "blur" ? "blur(38px)" : undefined);
  const bioId = $derived(`profile-bio-${profile.did.replace(/[^a-zA-Z0-9_-]/g, "-")}`);
  const profileBase = $derived(`/profile/${encodeURIComponent(profile.handle)}`);
  const faviconFailed = $derived(faviconFailedFor === profile.bskyUrl);
  const followersCount = $derived(
    Math.max(0, (profile.followersCount ?? 0) + followsStore.delta(profile.did)),
  );
</script>

<header
  class={cn(
    "relative isolate overflow-hidden h-[clamp(220px,32vw,320px)] border border-line",
    "max-mobile:-mx-[var(--pad)]",
    "shadow-[0_24px_48px_-36px_var(--shadow-drop)]",
    "before:content-[''] before:absolute before:inset-0 before:pointer-events-none",
    "before:bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.55)_12%,rgba(0,0,0,0.25)_26%,rgba(0,0,0,0.08)_38%,rgba(0,0,0,0)_50%)]",
  )}
>
  <div
    aria-hidden="true"
    class="absolute inset-0 z-[-1] bg-cover bg-center"
    style:background-image={bannerBg}
    style:filter={blur}
  ></div>
  <div class="absolute inset-0 flex flex-col items-start justify-center gap-[12px] py-[20px] px-[24px] max-mobile:px-[16px]">
    <div
      class="w-[clamp(96px,14vw,160px)] h-[clamp(96px,14vw,160px)] flex-none bg-cover bg-center border border-line shadow-[inset_0_0_0_3px_var(--color-ink-raised),0_18px_36px_-24px_var(--shadow-drop)]"
      style:background-image={avatarBg}
      style:filter={blur}
    ></div>
    <div class="flex flex-col items-start gap-[6px]">
      <h1 class="m-0 font-display text-[clamp(22px,4vw,30px)] font-[500] tracking-[-0.02em] leading-[1.1] text-paper bg-overlay backdrop-blur-[8px] border border-line p-[5px_13px]">
        {name}
      </h1>
      <span class="text-[12px] tracking-[0.04em] text-mist bg-overlay backdrop-blur-[8px] border border-line p-[3px_9px]">
        @{profile.handle}
      </span>
    </div>
  </div>
  <div class="absolute bottom-[14px] right-[14px] flex items-center gap-[5px] bg-overlay backdrop-blur-[8px] border border-line p-[5px]">
    <a
      href={profile.bskyUrl}
      target="_blank"
      rel="noreferrer noopener"
      class="group/conn size-[22px] flex-none inline-flex items-center justify-center overflow-hidden bg-none text-accent-ink text-[11px] font-[700] border-none p-0 cursor-pointer no-underline hover:brightness-[1.08]"
      title="Bluesky"
      aria-label="Bluesky"
    >
      {#if faviconFailed}
        <span
          class="size-full inline-flex items-center justify-center"
          style:background="var(--fixed-bsky)"
          aria-hidden="true"
        >
          B
        </span>
      {:else}
        <img
          class="size-full box-border bg-ink-raised object-contain p-[3px] group-hover/conn:shadow-[inset_0_0_0_1px_var(--color-primary)]"
          src={BSKY_FAVICON}
          alt=""
          width={16}
          height={16}
          onerror={() => {
            faviconFailedFor = profile.bskyUrl;
          }}
        />
      {/if}
    </a>
  </div>
  {#if cover}
    <ArtworkVeil
      variant={cover}
      peeked={contentVeil.peeked}
      animated={contentVeil.animated}
      onReveal={() => contentVeil.reveal()}
      label={`Uncensor @${profile.handle}'s banner`}
    />
  {/if}
</header>

<div class="flex items-start flex-wrap gap-[24px] mt-[14px] max-mobile:items-center max-mobile:gap-[10px] max-mobile:-mx-[12px] max-mobile:mt-[8px]">
  <div class="flex-1 min-w-[280px] max-mobile:order-3 max-mobile:basis-full max-mobile:min-w-0">
    {#if profile.description}
      <ExpandableText
        description={profile.description}
        id={bioId}
        class="m-0 text-[15.5px] text-paper whitespace-pre-wrap break-words max-mobile:text-[13px]"
        collapsedClass="line-clamp-4"
      />
    {/if}
  </div>

  <div class="flex gap-[26px] py-[6px] max-mobile:order-1 max-mobile:flex-1 max-mobile:flex-wrap max-mobile:items-baseline max-mobile:gap-x-[10px] max-mobile:gap-y-[6px]">
    <a
      href={`${profileBase}/followers`}
      class={cn(STAT_LINK, section === "followers" ? "text-primary" : "text-paper")}
    >
      <b class={STAT_VALUE}>{followersCount}</b>{" "}
      <span class={STAT_LABEL}>Followers</span>
    </a>
    <span class="hidden max-mobile:inline text-[13px] text-faint" aria-hidden="true">·</span>
    <a
      href={`${profileBase}/following`}
      class={cn(STAT_LINK, section === "following" ? "text-primary" : "text-paper")}
    >
      <b class={STAT_VALUE}>{profile.followsCount ?? 0}</b>{" "}
      <span class={STAT_LABEL}>Following</span>
    </a>
    <span class="hidden max-mobile:inline text-[13px] text-faint" aria-hidden="true">·</span>
    <a href={profileBase} class={cn(STAT_LINK, "text-paper")}>
      <b class={STAT_VALUE}>{artCount}</b> <span class={STAT_LABEL}>Pieces</span>
    </a>
  </div>

  <div class="flex items-center gap-[8px] py-[6px] max-mobile:order-2 max-mobile:py-0">
    <FollowButton subjectDid={profile.did} subjectHandle={profile.handle} variant="default" />
  </div>
</div>
