import { sveltekit } from "@sveltejs/kit/vite";
import { hatk } from "@hatk/hatk/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  plugins: lazyPlugins(() => [tailwindcss(), hatk(), sveltekit()]),
  test: {
    include: ["test/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["test/browser/**"],
  },
  lint: {
    ignorePatterns: [
      "hatk.generated.ts",
      "hatk.generated.client.ts",
      "lexicons/app/**",
      "lexicons/com/**",
      "lexicons/dev/**",
    ],
  },
  fmt: {
    ignorePatterns: [
      "hatk.generated.ts",
      "hatk.generated.client.ts",
      "lexicons/app/**",
      "lexicons/com/**",
      "lexicons/dev/**",
      ".beads/**",
      ".agents/**",
      ".claude/**",
      ".hermes/**",
    ],
  },
});
