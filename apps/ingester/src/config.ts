import { PUBLIC_BSKY_APPVIEW_URL } from "@ratat/common";
import { Config as EffectConfig, type ConfigError, Context, Effect, Layer } from "effect";

export interface IngesterConfig {
  readonly appviewUrl: string;
  /** Where DID documents are read from, which is how a repo's PDS is found. */
  readonly plcDirectoryUrl: string;
  readonly jetstreamUrl: string;
  /** How often the tail re-reads the interested set to re-scope itself. */
  readonly didRefreshSeconds: number;
  /** Events between cursor writes. */
  readonly checkpointEvery: number;
  /**
   * Whether to tail `app.bsky.feed.like`. Likes live in the liker's repo, so
   * this subscription cannot be scoped by DID — it is the whole like firehose,
   * filtered locally down to subjects we index.
   */
  readonly likeTail: boolean;
  readonly backfillPollSeconds: number;
  readonly backfillPageSize: number;
  readonly backfillPageDelayMillis: number;
  /** Guard against a pathological account; 0 means walk the whole feed. */
  readonly backfillMaxPages: number;
  readonly backfillRetryMinutes: number;
}

export class IngesterSettings extends Context.Tag("@ratat/ingester/Settings")<
  IngesterSettings,
  IngesterConfig
>() {}

export const SettingsLive: Layer.Layer<IngesterSettings, ConfigError.ConfigError> = Layer.effect(
  IngesterSettings,
  Effect.gen(function* () {
    return IngesterSettings.of({
      appviewUrl: yield* EffectConfig.string("BSKY_APPVIEW_URL").pipe(
        EffectConfig.withDefault(PUBLIC_BSKY_APPVIEW_URL),
      ),
      plcDirectoryUrl: yield* EffectConfig.string("PLC_DIRECTORY_URL").pipe(
        EffectConfig.withDefault("https://plc.directory"),
      ),
      jetstreamUrl: yield* EffectConfig.string("JETSTREAM_URL").pipe(
        EffectConfig.withDefault("wss://jetstream2.us-east.bsky.network"),
      ),
      didRefreshSeconds: yield* EffectConfig.integer("JETSTREAM_DID_REFRESH_SECONDS").pipe(
        EffectConfig.withDefault(30),
      ),
      checkpointEvery: yield* EffectConfig.integer("JETSTREAM_CHECKPOINT_EVERY").pipe(
        EffectConfig.withDefault(50),
      ),
      likeTail: yield* EffectConfig.boolean("JETSTREAM_LIKE_TAIL").pipe(
        EffectConfig.withDefault(true),
      ),
      backfillPollSeconds: yield* EffectConfig.integer("BACKFILL_POLL_SECONDS").pipe(
        EffectConfig.withDefault(5),
      ),
      backfillPageSize: yield* EffectConfig.integer("BACKFILL_PAGE_SIZE").pipe(
        EffectConfig.withDefault(100),
      ),
      backfillPageDelayMillis: yield* EffectConfig.integer("BACKFILL_PAGE_DELAY_MS").pipe(
        EffectConfig.withDefault(250),
      ),
      backfillMaxPages: yield* EffectConfig.integer("BACKFILL_MAX_PAGES").pipe(
        EffectConfig.withDefault(0),
      ),
      backfillRetryMinutes: yield* EffectConfig.integer("BACKFILL_RETRY_MINUTES").pipe(
        EffectConfig.withDefault(30),
      ),
    });
  }),
);
