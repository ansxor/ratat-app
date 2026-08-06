import { XRPCError } from "@atcute/xrpc-server";

export const internalError = (): XRPCError =>
  new XRPCError({ status: 500, error: "InternalServerError" });

export const profileNotFound = (actor: string): XRPCError =>
  new XRPCError({
    status: 400,
    error: "ProfileNotFound",
    message: `could not resolve ${actor}`,
  });

export const upstreamFailure = (message: string): XRPCError =>
  new XRPCError({ status: 502, error: "UpstreamFailure", message });
