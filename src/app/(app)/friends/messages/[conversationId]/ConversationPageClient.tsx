"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConversationView } from "@/components/friends/ConversationView";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale/LocaleProvider";

export const conversationPageClassName = "fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] md:static md:h-[calc(100vh-4rem)] md:rounded-xl md:border md:border-border";

export function ConversationPageClient({ conversationId }: { conversationId: string }) {
  const { messages } = useLocale();
  const router = useRouter();
  return <section className={conversationPageClassName} aria-labelledby="conversation-heading">
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-3">
      <Button type="button" variant="ghost" size="icon" onClick={() => router.push("/friends?view=messages")} aria-label={messages.friends.backToMessages}><ArrowLeft className="size-5" /></Button>
      <div><h1 id="conversation-heading" className="text-sm font-semibold">{messages.friends.conversationTitle}</h1><p className="text-xs text-muted-foreground">{messages.friends.privateConversation}</p></div>
    </header>
    <ConversationView conversationId={conversationId} />
  </section>;
}
