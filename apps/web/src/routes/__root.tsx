import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { Masthead } from "#/components/Masthead.tsx";
import { SessionProvider } from "#/lib/session.tsx";
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
      </head>
      <body>
        <SessionProvider>
          <Masthead />
          {children}
        </SessionProvider>

        <Scripts />
      </body>
    </html>
  );
}
