import { XRPCError } from "@atcute/xrpc-server";

export const internalError = (): XRPCError =>
  new XRPCError({ status: 500, error: "InternalServerError" });

export const profileNotFound = (actor: string): XRPCError =>
  new XRPCError({
    status: 400,
    error: "ProfileNotFound",
    message: `could not resolve ${actor}`,
  });

export const postNotFound = (actor: string, rkey: string): XRPCError =>
  new XRPCError({
    status: 400,
    error: "PostNotFound",
    message: `no artwork at ${rkey} for ${actor}`,
  });

export const invalidCursor = (): XRPCError =>
  new XRPCError({
    status: 400,
    error: "InvalidRequest",
    message: "that cursor did not come from here",
  });

export const upstreamFailure = (message: string): XRPCError =>
  new XRPCError({ status: 502, error: "UpstreamFailure", message });
