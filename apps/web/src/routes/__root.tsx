import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { DevLoopbackRedirect } from "#/components/DevLoopbackRedirect.tsx";
import { Masthead } from "#/components/Masthead.tsx";
import { FollowsProvider } from "#/lib/follows.tsx";
import { PaginationViewportProvider } from "#/lib/pagination.tsx";
import { SessionProvider } from "#/lib/session.tsx";
import { SettingsProvider } from "#/lib/settings.tsx";
import { THEME_BOOT_SCRIPT } from "#/lib/theme.ts";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Ratat",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <PaginationViewportProvider>
          <SettingsProvider>
            <SessionProvider>
              <FollowsProvider>
                <DevLoopbackRedirect />
                <Masthead />
                {children}
              </FollowsProvider>
            </SessionProvider>
          </SettingsProvider>
        </PaginationViewportProvider>

        <Scripts />
      </body>
    </html>
  );
}
