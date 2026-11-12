<script module lang="ts">
  export type IconName =
    | "arrow-left"
    | "arrow-right"
    | "check"
    | "chevron-right"
    | "chevron-down"
    | "chevron-up"
    | "eye"
    | "eye-off"
    | "blur"
    | "heart"
    | "home"
    | "image"
    | "sign-in"
    | "chat"
    | "system-theme"
    | "dark-theme"
    | "plus"
    | "boost"
    | "search"
    | "settings"
    | "blackout"
    | "star"
    | "light-theme"
    | "bluesky"
    | "x";
</script>

<script lang="ts">
  import { cn } from "$lib/utils.ts";

  let {
    name,
    size = 24,
    width,
    strokeWidth = 2,
    fill = "none",
    tone = "brand",
    class: className,
  }: {
    name: IconName;
    size?: number;
    width?: number;
    strokeWidth?: number;
    fill?: string;
    tone?: "brand" | "current";
    class?: string;
  } = $props();

  const bskyWidth = $derived(width ?? 17);
</script>

{#if name === "bluesky"}
  <svg
    width={bskyWidth}
    height={Math.round((bskyWidth * 530) / 600)}
    viewBox="0 0 600 530"
    class={cn("flex-none", className)}
    aria-hidden="true"
  >
    <path
      fill={tone === "brand" ? "var(--fixed-bsky)" : "currentColor"}
      d="M135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.194.517-3.708 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.449-163.25-81.433C20.15 217.613 9.997 86.535 9.997 68.825c0-88.687 77.742-60.816 125.72-24.795z"
    />
  </svg>
{:else}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    {fill}
    stroke="currentColor"
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
    aria-hidden="true"
  >
    {#if name === "arrow-left"}
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    {:else if name === "arrow-right"}
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    {:else if name === "check"}
      <path d="M20 6 9 17l-5-5" />
    {:else if name === "chevron-right"}
      <path d="m9 18 6-6-6-6" />
    {:else if name === "chevron-down"}
      <path d="m6 9 6 6 6-6" />
    {:else if name === "chevron-up"}
      <path d="m18 15-6-6-6 6" />
    {:else if name === "eye"}
      <path
        d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
      />
      <circle cx="12" cy="12" r="3" />
    {:else if name === "eye-off"}
      <path
        d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
      />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path
        d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
      />
      <path d="m2 2 20 20" />
    {:else if name === "blur"}
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    {:else if name === "heart"}
      <path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
      />
    {:else if name === "home"}
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path
        d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      />
    {:else if name === "image"}
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    {:else if name === "sign-in"}
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" x2="3" y1="12" y2="12" />
    {:else if name === "chat"}
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    {:else if name === "system-theme"}
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    {:else if name === "dark-theme"}
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    {:else if name === "plus"}
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    {:else if name === "boost"}
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    {:else if name === "search"}
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    {:else if name === "settings"}
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <circle cx="12" cy="12" r="3" />
    {:else if name === "blackout"}
      <rect width="18" height="18" x="3" y="3" rx="2" />
    {:else if name === "star"}
      <path
        d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
      />
    {:else if name === "light-theme"}
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    {:else if name === "x"}
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    {/if}
  </svg>
{/if}
