import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { ArtworkVeil } from "#/components/content/ArtworkVeil.tsx";
import { FollowButton } from "#/components/FollowButton.tsx";
import { PLACEHOLDER_GRADIENT } from "#/lib/avatar.ts";
import type { Profile } from "#/lib/ratat.ts";
import { useContentVeil } from "#/lib/settings.tsx";
import { cn } from "#/lib/utils.ts";

const STAT_LINK =
  "no-underline font-bold text-[14px] transition-colors duration-[140ms] hover:text-primary";
const STAT_LABEL = "text-[12px] opacity-60";

const BSKY_FAVICON = "https://www.google.com/s2/favicons?domain=bsky.app&sz=64";
// theme-invariant: Bluesky's brand colour, from the old app's connections palette.
const BSKY_BRAND = "#1185fe";

/**
 * The old app's banner connections overlay, ported down to the one link Ratat
 * can always offer: Bluesky itself. The favicon falls back to a brand-colour
 * badge when Google's favicon service is unreachable.
 */
function BlueskyConnection({ url }: { url: string }) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="group/conn size-[22px] flex-none inline-flex items-center justify-center overflow-hidden bg-none text-accent-ink text-[11px] font-[700] border-none p-0 cursor-pointer no-underline hover:brightness-[1.08]"
      title="Bluesky"
      aria-label="Bluesky"
    >
      {failedSrc ? (
        <span
          className="size-full inline-flex items-center justify-center"
          style={{ background: BSKY_BRAND }}
          aria-hidden
        >
          B
        </span>
      ) : (
        <img
          className="size-full box-border bg-ink-raised object-contain p-[3px] group-hover/conn:shadow-[inset_0_0_0_1px_var(--color-primary)]"
          src={BSKY_FAVICON}
          alt=""
          width={16}
          height={16}
          onError={() => setFailedSrc(BSKY_FAVICON)}
        />
      )}
    </a>
  );
}

export type ProfileSection = "art" | "following" | "followers";

/**
 * The counts are Ratat's own, so each number links to the list that proves
 * it — the one place the old app's stats row was ported from wholesale.
 */
function ProfileStats({
  profile,
  section,
  artCount,
}: {
  profile: Profile;
  section: ProfileSection;
  artCount: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[6px] py-[4px]">
      <Link
        to="/profile/$handle/followers"
        params={{ handle: profile.handle }}
        className={cn(STAT_LINK, section === "followers" ? "text-primary" : "text-paper")}
      >
        <b>{profile.followersCount ?? 0}</b> <span className={STAT_LABEL}>Followers</span>
      </Link>
      <span className="text-[13px] text-faint" aria-hidden="true">
        ·
      </span>
      <Link
        to="/profile/$handle/following"
        params={{ handle: profile.handle }}
        className={cn(STAT_LINK, section === "following" ? "text-primary" : "text-paper")}
      >
        <b>{profile.followsCount ?? 0}</b> <span className={STAT_LABEL}>Following</span>
      </Link>
      <span className="text-[13px] text-faint" aria-hidden="true">
        ·
      </span>
      <Link
        to="/profile/$handle"
        params={{ handle: profile.handle }}
        className={cn(STAT_LINK, "text-paper")}
      >
        <b>{artCount}</b> <span className={STAT_LABEL}>Pieces</span>
      </Link>
    </div>
  );
}

/**
 * An account-level label covers the banner and the avatar, which are the only
 * artwork this header shows. It never takes the page away: somebody who
 * followed a link to an artist asked for this page, and the works below are
 * filtered on their own labels anyway.
 */
export function ProfileHeader({
  profile,
  artCount,
  section = "art",
}: {
  profile: Profile;
  artCount: number;
  section?: ProfileSection;
}) {
  const { hidden, veil, peeked, animated, reveal } = useContentVeil(profile.labels);
  const cover = hidden ? "black" : veil;
  const covered = cover !== null && !peeked;

  const name = profile.displayName?.trim() || profile.handle;
  const bannerBg = profile.banner ? `url(${profile.banner})` : PLACEHOLDER_GRADIENT;
  const avatarBg = profile.avatar ? `url(${profile.avatar})` : PLACEHOLDER_GRADIENT;
  const blur = covered && cover === "blur" ? "blur(38px)" : undefined;

  return (
    <>
      <header
        className={cn(
          // `isolate` keeps the banner layer's negative z inside this header.
          "relative isolate overflow-hidden h-[clamp(220px,32vw,320px)] border border-line",
          // Mobile full-bleed: the header escapes `.wrap`'s inline padding to
          // reach the window edges, matching the gallery below it. Desktop keeps
          // the wrap padding.
          "max-[880px]:-mx-[var(--pad)]",
          "shadow-[0_24px_48px_-36px_var(--shadow-drop)]",
          "before:content-[''] before:absolute before:inset-0 before:pointer-events-none",
          // theme-invariant: contrast over arbitrary user artwork.
          "before:bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.55)_12%,rgba(0,0,0,0.25)_26%,rgba(0,0,0,0.08)_38%,rgba(0,0,0,0)_50%)]",
        )}
      >
        {/* Its own layer, behind the gradient, so blurring the banner cannot blur the name over it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[-1] bg-cover bg-center"
          style={{ backgroundImage: bannerBg, ...(blur ? { filter: blur } : {}) }}
        />
        <div className="absolute inset-0 flex flex-col items-start justify-center gap-[12px] p-[20px_16px]">
          <div
            className="w-[clamp(96px,14vw,160px)] h-[clamp(96px,14vw,160px)] flex-none bg-cover bg-center border border-line shadow-[inset_0_0_0_3px_var(--color-ink-raised),0_18px_36px_-24px_var(--shadow-drop)]"
            style={{ backgroundImage: avatarBg, ...(blur ? { filter: blur } : {}) }}
          />
          <div className="flex flex-col items-start gap-[6px]">
            <h1 className="m-0 font-display text-[clamp(22px,4vw,30px)] font-[500] tracking-[-0.02em] leading-[1.1] text-paper bg-overlay backdrop-blur-[8px] border border-line p-[5px_13px]">
              {name}
            </h1>
            <span className="text-[12px] tracking-[0.04em] text-mist bg-overlay backdrop-blur-[8px] border border-line p-[3px_9px]">
              @{profile.handle}
            </span>
          </div>
        </div>
        <div className="absolute bottom-[14px] right-[14px] flex items-center gap-[5px] bg-overlay backdrop-blur-[8px] border border-line p-[5px]">
          <BlueskyConnection url={profile.bskyUrl} />
        </div>
        {cover && (
          <ArtworkVeil
            variant={cover}
            peeked={peeked}
            animated={animated}
            onReveal={reveal}
            label={`Uncensor @${profile.handle}'s banner`}
          />
        )}
      </header>

      <div className="flex items-center justify-between flex-wrap gap-[10px] mt-[14px]">
        <ProfileStats profile={profile} section={section} artCount={artCount} />
        <FollowButton subject={profile.did} />
      </div>

      {profile.description && (
        <p className="m-0 mt-[10px] text-[15.5px] text-paper whitespace-pre-wrap break-words">
          {profile.description}
        </p>
      )}
    </>
  );
}
