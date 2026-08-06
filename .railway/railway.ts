import { defineRailway, github, postgres, project, service } from "railway/iac";

export default defineRailway(() => {
  const ratat = github("ansxor/ratat-app", { branch: "master" });

  const Postgres = postgres("Postgres");
  const ingester = service("ingester", {
    source: ratat,
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "bun apps/ingester/src/main.ts",
    replicas: { sfo: 1 },
    env: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
    },
  });
  const xrpcServer = service("xrpc-server", {
    source: ratat,
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "bun apps/xrpc-server/src/main.ts",
    preDeploy: "bun --filter '@ratat/db' migrate",
    replicas: { sfo: 1 },
    env: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
      HOST: "0.0.0.0",
    },
  });
  const web = service("web", {
    source: ratat,
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile.frontend" },
    start: "bun run --cwd apps/web start",
    replicas: { sfo: 1 },
    env: {
      VITE_RATAT_APPVIEW_URL: "https://${{xrpc-server.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });

  return project("ratat-app", {
    resources: [Postgres, ingester, xrpcServer, web],
  });
});
