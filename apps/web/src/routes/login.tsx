import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoginPanel } from "#/components/LoginPanel.tsx";
import { useSession } from "#/lib/session.tsx";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { session, restored } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (restored && session) void navigate({ to: "/", replace: true });
  }, [restored, session, navigate]);

  return <LoginPanel />;
}
