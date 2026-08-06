import { Client } from "@atcute/client";
import type {} from "@atcute/atproto";
import {
  CompositeDidDocumentResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  XrpcHandleResolver,
} from "@atcute/identity-resolver";
import type { ActorIdentifier, Did } from "@atcute/lexicons";
import {
  configureOAuth,
  createAuthorizationUrl,
  deleteStoredSession,
  finalizeAuthorization,
  getSession,
  listStoredSessions,
  OAuthUserAgent,
} from "@atcute/oauth-browser-client";
import { PUBLIC_BSKY_APPVIEW_URL } from "@ratat/common";

import { clientMetadata, OAUTH_SCOPE } from "./oauth-metadata.ts";

const HANDLE_RESOLVER_SERVICE =
  import.meta.env.VITE_ATPROTO_HANDLE_RESOLVER_URL ?? PUBLIC_BSKY_APPVIEW_URL;
const PLC_DIRECTORY_URL = import.meta.env.VITE_ATPROTO_PLC_URL ?? "https://plc.directory";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  configureOAuth({
    metadata: clientMetadata(window.location.origin),
    identityResolver: new LocalActorResolver({
      handleResolver: new XrpcHandleResolver({ serviceUrl: HANDLE_RESOLVER_SERVICE }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver({ apiUrl: PLC_DIRECTORY_URL }),
          web: new WebDidDocumentResolver(),
        },
      }),
    }),
  });
  configured = true;
}

export async function startSignIn(identifier: string): Promise<void> {
  ensureConfigured();
  const authUrl = await createAuthorizationUrl({
    target: { type: "account", identifier: identifier as ActorIdentifier },
    scope: OAUTH_SCOPE,
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  window.location.assign(authUrl.toString());
}

export async function completeSignIn(): Promise<Did> {
  ensureConfigured();
  const raw = window.location.hash.slice(1) || window.location.search.slice(1);
  const params = new URLSearchParams(raw);
  history.replaceState(null, "", window.location.pathname);
  const { session } = await finalizeAuthorization(params);
  return session.info.sub;
}

export async function restoreAgent(): Promise<OAuthUserAgent | null> {
  ensureConfigured();
  const [did] = listStoredSessions();
  if (!did) return null;
  try {
    return new OAuthUserAgent(await getSession(did, { allowStale: true }));
  } catch {
    deleteStoredSession(did);
    return null;
  }
}

export async function resolveAccountHandle(agent: OAuthUserAgent): Promise<string | undefined> {
  const res = await new Client({ handler: agent }).get("com.atproto.repo.describeRepo", {
    params: { repo: agent.sub as ActorIdentifier },
  });
  if (!res.ok) return undefined;
  return res.data.handleIsCorrect ? res.data.handle : undefined;
}

export async function signOut(): Promise<void> {
  ensureConfigured();
  const [did] = listStoredSessions();
  if (!did) return;
  try {
    await new OAuthUserAgent(await getSession(did, { allowStale: true })).signOut();
  } catch {
    deleteStoredSession(did);
  }
}
