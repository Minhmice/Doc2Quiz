import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SocialInvalidation = Readonly<{ type: "invalidate"; id: string; timestamp: string }>;

export async function broadcastSocialEvent(topic: string, event: string, payload: unknown): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const channel = supabase.channel(topic, { config: { private: true } });
  try {
    return (await channel.httpSend(event, payload)).success;
  } catch {
    return false;
  } finally {
    await supabase.removeChannel(channel);
  }
}

export function broadcastSocialInvalidation(topic: string, id: string): Promise<boolean> {
  return broadcastSocialEvent(topic, "invalidate", { type: "invalidate", id, timestamp: new Date().toISOString() } satisfies SocialInvalidation);
}
