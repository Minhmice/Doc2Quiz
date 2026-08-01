"use client";

import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/buttons/button";

export function ThemeToggle() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-10 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
      onClick={() => router.push("/settings")}
      aria-label="Open appearance settings"
    >
      <Settings className="size-[1.2rem]" />
      <span className="sr-only">Open appearance settings</span>
    </Button>
  );
}
