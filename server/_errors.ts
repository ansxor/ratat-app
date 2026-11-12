import { InvalidRequestError } from "@hatk/hatk/xrpc";

export class ProfileNotFoundError extends InvalidRequestError {
  constructor(actor: string) {
    super(`could not resolve ${actor}`, "ProfileNotFound");
  }
}

export class PostNotFoundError extends InvalidRequestError {
  constructor(actor: string, rkey: string) {
    super(`no artwork at ${rkey} for ${actor}`, "PostNotFound");
  }
}

export class InvalidCursorError extends InvalidRequestError {
  constructor(message = "that cursor did not come from here") {
    super(message, "InvalidRequest");
  }
}

export class AuthenticationRequiredError extends InvalidRequestError {
  constructor(message = "Authentication required") {
    super(message, "AuthenticationRequired");
  }
}

export class UpstreamFailureError extends InvalidRequestError {
  override status = 502;

  constructor(message = "could not reach the Bluesky appview") {
    super(message, "UpstreamFailure");
  }
}

export class AppviewError extends InvalidRequestError {
  override status: number;
  readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message, errorCode);
    this.status = status;
    this.errorCode = errorCode;
  }
}

const UNRESOLVABLE_ACTOR: Record<string, true> = {
  InvalidRequest: true,
  AccountDeactivated: true,
  AccountTakedown: true,
  ProfileNotFound: true,
};

export function actorRequestFailed(
  actor: string,
  payload: { error?: string; message?: string },
): InvalidRequestError {
  const code = payload.error ?? "";
  if (UNRESOLVABLE_ACTOR[code]) {
    return new ProfileNotFoundError(actor);
  }
  return new UpstreamFailureError(payload.message ?? (code || "upstream appview error"));
}
