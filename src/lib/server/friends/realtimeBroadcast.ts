import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
