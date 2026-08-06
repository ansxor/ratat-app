import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PLACEHOLDER_GRADIENT } from "#/lib/avatar.ts";
import { useFollows } from "#/lib/follows.tsx";
import {
  type BlueskyFollow,
  dismissFollowImport,
  hasDismissedFollowImport,
  importFollows,
  listBlueskyFollows,
} from "#/lib/graph.ts";
import { useSession } from "#/lib/session.tsx";
import { cn } from "#/lib/utils.ts";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

/**
 * The one onboarding step: turn the artists the viewer already follows on
 * Bluesky into Ratat follows, so home has something in it on the first visit.
 *
 * Ported from the old app's `components/onboarding/ImportStep.tsx` and its
 * wizard footer; what is picked has changed from posts to people, so the tile
 * grid became the old actor row. Offered once — nothing here syncs the two
 * graphs afterwards, and a Ratat follow never touches the Bluesky one.
 */
function OnboardingPage() {
  const { session, restored } = useSession();
  const { follows, loaded, reload } = useFollows();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState<BlueskyFollow[] | undefined>(undefined);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const agent = session?.agent;
  // Somebody who already has a Ratat graph, or who has said no once, is done.
  const settled = restored && loaded;
  const skip = settled && (!session || follows.size > 0 || hasDismissedFollowImport());

  useEffect(() => {
    if (skip) void navigate({ to: "/", replace: true });
  }, [skip, navigate]);

  useEffect(() => {
    if (!agent || skip) return;
    const controller = new AbortController();
    listBlueskyFollows(agent, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setCandidates(found);
        setSelected(new Set(found.map((account) => account.did)));
      })
      .catch(() => {
        if (!controller.signal.aborted) setCandidates([]);
      });
    return () => controller.abort();
  }, [agent, skip]);

  const leave = () => {
    dismissFollowImport();
    void navigate({ to: "/", replace: true });
  };

  const confirm = async () => {
    if (!agent) return;
    const subjects = (candidates ?? [])
      .map((account) => account.did)
      .filter((did) => selected.has(did));
    if (subjects.length === 0) {
      leave();
      return;
    }

    setBusy(true);
    setError("");
    try {
      await importFollows(agent, subjects);
      dismissFollowImport();
      reload();
      void navigate({ to: "/", replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
      setBusy(false);
    }
  };

  const toggle = (did: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(did)) next.delete(did);
      else next.add(did);
      return next;
    });
  };

  if (!settled || skip) {
    return (
      <div className="min-h-dvh flex flex-col">
        <div className="flex-1 grid place-items-center px-4 py-16 text-mist text-[14px]">
          Preparing your setup…
        </div>
      </div>
    );
  }

  const accounts = candidates ?? [];
  const loading = candidates === undefined;
  const count = selected.size;
  const primaryLabel = busy
    ? "Following…"
    : count > 0
      ? `Follow ${count} artist${count === 1 ? "" : "s"} →`
      : "Continue without following anyone →";

  return (
    <main className="flex-1 flex flex-col items-center px-pad pt-[40px] pb-[70px] w-full box-border">
      <section className="w-[1000px] max-w-full" aria-label="Import your Bluesky follows">
        <h1 className="m-0 font-display text-[clamp(30px,4vw,42px)] font-[500] tracking-[-0.02em] leading-[1.02]">
          Bring your follows over
        </h1>
        <p className="mt-[14px] text-[15.5px] text-mist max-w-[52ch]">
          {loading
            ? "Looking at who you follow on Bluesky…"
            : accounts.length > 0
              ? `You follow ${accounts.length} account${accounts.length === 1 ? "" : "s"} on Bluesky. Pick the ones whose art you want in your Ratat gallery — following here is separate from Bluesky, so unpicking someone changes nothing there.`
              : "You don't follow anyone on Bluesky yet. Open an artist's portfolio and follow them from there."}
        </p>

        {accounts.length > 0 && (
          <>
            <div className="flex items-center gap-[10px] bg-overlay border border-line px-[10px] py-[5px] mt-[24px]">
              <span className="text-[11px] font-[700] tracking-[0.1em] text-mist whitespace-nowrap uppercase">
                <b className="text-primary">{count}</b> / {accounts.length} selected
              </span>
              <div className="ml-auto flex gap-[6px]">
                <button
                  type="button"
                  className={cn("btn btn--ghost", "px-[10px] py-[4px] text-[12px]")}
                  onClick={() => setSelected(new Set(accounts.map((account) => account.did)))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className={cn("btn btn--ghost", "px-[10px] py-[4px] text-[12px]")}
                  onClick={() => setSelected(new Set())}
                >
                  Select none
                </button>
              </div>
            </div>

            <div className="mt-[6px] border border-line bg-ink-raised max-h-[420px] overflow-y-auto">
              {accounts.map((account) => {
                const picked = selected.has(account.did);
                return (
                  <button
                    key={account.did}
                    type="button"
                    className="group flex w-full items-center gap-[10px] px-[14px] py-[9px] border-b border-line-soft last:border-b-0 text-left cursor-pointer bg-transparent hover:bg-ink-hi"
                    onClick={() => toggle(account.did)}
                    aria-pressed={picked}
                  >
                    <span
                      className="size-[32px] flex-none bg-cover bg-center border border-line shadow-[inset_0_0_0_2px_var(--color-ink-raised)]"
                      style={{
                        backgroundImage: account.avatar
                          ? `url(${account.avatar})`
                          : PLACEHOLDER_GRADIENT,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-[700] leading-[1.25] truncate text-paper">
                        {account.displayName?.trim() || account.handle}
                      </span>
                      <span className="block text-[11px] tracking-[0.02em] text-faint truncate">
                        @{account.handle}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "size-[22px] flex-none flex items-center justify-center text-[13px] font-[700] border",
                        picked
                          ? "bg-primary text-accent-ink border-primary"
                          : "bg-transparent text-transparent border-line-2",
                      )}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-[14px] mb-0 text-[13px] text-[var(--danger)] leading-[1.5]">
            {error}
          </p>
        )}

        <div className="flex justify-between items-center gap-[20px] mt-[40px] pt-[20px] border-t border-line max-[680px]:flex-col max-[680px]:items-stretch">
          <button type="button" className="btn btn--ghost" onClick={leave} disabled={busy}>
            Skip for now
          </button>
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => void confirm()}
            disabled={busy || loading}
          >
            {primaryLabel}
          </button>
        </div>
      </section>
    </main>
  );
}
