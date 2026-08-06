import type { Profile } from "#/lib/ratat.ts";

export function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-ink-raised shadow-sm shadow-shadow">
      {profile.banner ? (
        <img src={profile.banner} alt="" className="h-40 w-full bg-mat object-cover" />
      ) : (
        <div className="h-20 w-full bg-mat" />
      )}

      <div className="flex flex-wrap items-end gap-md px-xl pb-xl">
        <img
          src={profile.avatar}
          alt=""
          width={88}
          height={88}
          className="-mt-lg size-[88px] rounded-lg border border-line-2 bg-mat object-cover"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-h3 text-paper">
            {profile.displayName ?? profile.handle}
          </h1>
          <p className="truncate text-body-sm text-faint">@{profile.handle}</p>
        </div>
        <a
          href={profile.bskyUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-pill border border-bsky-line bg-bsky-tint px-md py-xs text-body-sm text-bsky hover:bg-bsky-tint-hi"
        >
          On Bluesky
        </a>
      </div>

      {profile.description ? (
        <p className="whitespace-pre-wrap px-xl pb-xl text-body-sm text-mist">
          {profile.description}
        </p>
      ) : null}

      <dl className="flex gap-xl border-t border-line-soft px-xl py-md text-body-sm">
        <Stat label="Followers" value={profile.followersCount} />
        <Stat label="Following" value={profile.followsCount} />
        <Stat label="Posts" value={profile.postsCount} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex gap-xs">
      <dt className="text-faint">{label}</dt>
      <dd className="text-paper">{value ?? 0}</dd>
    </div>
  );
}
