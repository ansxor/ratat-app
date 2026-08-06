import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { SignInIcon } from "#/components/ui/icons.tsx";
import { PLACEHOLDER_GRADIENT } from "#/lib/avatar.ts";
import { getProfile } from "#/lib/ratat.ts";
import { useSession } from "#/lib/session.tsx";

const GLYPH = { size: 16, strokeWidth: 2.2 } as const;

const AVATAR_CLASS =
  "size-[28px] rounded-none flex-none border border-line shadow-[inset_0_0_0_2px_var(--color-ink-raised)]";

function useMastheadAvatar(did: string | undefined) {
  const [avatar, setAvatar] = useState<string | undefined>(undefined);

  useEffect(() => {
    setAvatar(undefined);
    if (!did) return;
    const controller = new AbortController();
    getProfile(did, controller.signal)
      .then((profile) => {
        if (!controller.signal.aborted) setAvatar(profile.avatar);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [did]);

  return avatar;
}

export function AuthControl() {
  const { session, restored, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatar = useMastheadAvatar(session?.did);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleSignOut = useCallback(() => {
    setMenuOpen(false);
    void signOut();
  }, [signOut]);

  if (!restored) {
    return (
      <span
        className={`${AVATAR_CLASS} bg-ink-hi cursor-default pointer-events-none animate-pulse-soft`}
        aria-hidden="true"
      />
    );
  }

  if (!session) {
    return (
      <Link className="btn btn--accent" to="/login">
        <SignInIcon {...GLYPH} />
        Sign In
      </Link>
    );
  }

  const handle = session.handle ?? session.did;
  return (
    <div className="relative flex" ref={menuRef}>
      <button
        type="button"
        className={`${AVATAR_CLASS} cursor-pointer p-0`}
        aria-label={`Signed in as ${handle} — open account menu`}
        title={handle}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        style={
          avatar
            ? {
                backgroundImage: `url(${avatar})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: PLACEHOLDER_GRADIENT }
        }
      />
      {menuOpen && (
        <div
          className="absolute top-[calc(100%+8px)] right-0 min-w-[150px] bg-ink-raised border border-line shadow-[0_12px_28px_-12px_var(--shadow-drop)] z-60 flex flex-col"
          role="menu"
        >
          {session.handle ? (
            <Link
              className="block w-full text-left bg-none border-none border-b border-b-line-soft font-body text-[13px] font-[600] text-paper px-[12px] py-[8px] cursor-pointer last:border-b-0 hover:bg-ink-hi hover:text-paper"
              to="/profile/$handle"
              params={{ handle: session.handle }}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              My profile
            </Link>
          ) : null}
          <button
            type="button"
            className="block w-full text-left bg-none border-none border-b border-b-line-soft font-body text-[13px] font-[600] text-paper px-[12px] py-[8px] cursor-pointer last:border-b-0 hover:bg-ink-hi hover:text-paper"
            role="menuitem"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
