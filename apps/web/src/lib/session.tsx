import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import { resolveAccountHandle, restoreAgent, signOut as endSession } from "./oauth.ts";

export interface Session {
  agent: OAuthUserAgent;
  did: string;
  handle?: string;
}

interface SessionState {
  session: Session | null;
  restored: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  session: null,
  restored: false,
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const agent = await restoreAgent();
      if (!live) return;
      if (!agent) {
        setRestored(true);
        return;
      }
      setSession({ agent, did: agent.sub });
      setRestored(true);
      const handle = await resolveAccountHandle(agent);
      if (live && handle) setSession({ agent, did: agent.sub, handle });
    })();
    return () => {
      live = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await endSession();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, restored, signOut }), [session, restored, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  return use(SessionContext);
}
