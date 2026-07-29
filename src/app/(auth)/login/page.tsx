import { Suspense } from "react";

import { LoginClient } from "@/app/(auth)/login/LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}
    >
      <LoginClient />
    </Suspense>
  );
}
