import { Link } from "@tanstack/react-router";

import { FollowButton } from "#/components/FollowButton.tsx";
import { ImageIcon } from "#/components/ui/icons.tsx";
import { TabNav, type TabNavItem } from "#/components/ui/TabNav.tsx";
import { PLACEHOLDER_GRADIENT } from "#/lib/avatar.ts";
import type { Profile } from "#/lib/ratat.ts";
import { cn } from "#/lib/utils.ts";

const STAT_VALUE = "font-display text-[22px] font-[500] leading-none";
const STAT_LABEL = "font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint";

function ProfileStats({ profile }: { profile: Profile }) {
  return (
    <div className="flex gap-[26px] py-[6px]">
      <span className="flex flex-col gap-[2px] items-start text-paper">
        <b className={STAT_VALUE}>{profile.followersCount ?? 0}</b>
        <span className={STAT_LABEL}>Followers</span>
      </span>
      <span className="flex flex-col gap-[2px] items-start text-paper">
        <b className={STAT_VALUE}>{profile.followsCount ?? 0}</b>
        <span className={STAT_LABEL}>Following</span>
      </span>
      <Link
        to="/profile/$handle"
        params={{ handle: profile.handle }}
        className="flex flex-col gap-[2px] items-start no-underline text-paper"
      >
        <b className={STAT_VALUE}>{profile.postsCount ?? 0}</b>
        <span className={STAT_LABEL}>Pieces</span>
      </Link>
    </div>
  );
}

export function ProfileHeader({ profile, artCount }: { profile: Profile; artCount: number }) {
  const name = profile.displayName?.trim() || profile.handle;
  const bannerBg = profile.banner ? `url(${profile.banner})` : PLACEHOLDER_GRADIENT;
  const avatarBg = profile.avatar ? `url(${profile.avatar})` : PLACEHOLDER_GRADIENT;

  const tabs: TabNavItem[] = [
    {
      key: "art",
      link: { to: "/profile/$handle", params: { handle: profile.handle } },
      label: artCount ? `Art · ${artCount}` : "Art",
      icon: <ImageIcon />,
    },
  ];

  return (
    <>
      <header
        className={cn(
          "relative h-[clamp(220px,32vw,320px)] border border-line",
          "shadow-[0_24px_48px_-36px_var(--shadow-drop)]",
          "before:content-[''] before:absolute before:inset-0 before:pointer-events-none",
          // theme-invariant: contrast over arbitrary user artwork.
          "before:bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.55)_12%,rgba(0,0,0,0.25)_26%,rgba(0,0,0,0.08)_38%,rgba(0,0,0,0)_50%)]",
        )}
        style={{
          backgroundImage: bannerBg,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-start justify-center gap-[12px] p-[20px_24px]">
          <div
            className="w-[clamp(96px,14vw,160px)] h-[clamp(96px,14vw,160px)] flex-none bg-cover bg-center border border-line shadow-[inset_0_0_0_3px_var(--color-ink-raised),0_18px_36px_-24px_var(--shadow-drop)]"
            style={{ backgroundImage: avatarBg }}
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
      </header>

      <div className="flex gap-[24px] items-start flex-wrap mt-[14px]">
        <div className="flex-1 min-w-[280px]">
          {profile.description && (
            <p className="m-0 text-[15.5px] text-paper whitespace-pre-wrap break-words">
              {profile.description}
            </p>
          )}
        </div>

        <ProfileStats profile={profile} />

        <div className="flex items-center gap-[8px] py-[6px]">
          <FollowButton subject={profile.did} />
          <a
            className="btn btn--ghost"
            href={profile.bskyUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            On Bluesky
          </a>
        </div>
      </div>

      <TabNav items={tabs} activeKey="art" ariaLabel="Profile sections" />
    </>
  );
}
