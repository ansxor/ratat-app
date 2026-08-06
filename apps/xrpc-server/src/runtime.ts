import { type ConfigError, type ManagedRuntime } from "effect";

import { Appview, AppviewLive } from "./appview.ts";

export type AppServices = Appview;

export const AppLive = AppviewLive;

export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, ConfigError.ConfigError>;

export { Appview };
