import { notFound } from "next/navigation";
import { z } from "zod";

import { ConversationPageClient } from "./ConversationPageClient";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!z.string().uuid().safeParse(conversationId).success) notFound();
  return <ConversationPageClient conversationId={conversationId} />;
}
