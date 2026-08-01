"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PRESET_REACTION_IDS, touchSocialActivity, type PresetReactionId } from "@/lib/client/messages";

const copy: Record<PresetReactionId, string> = { xin_chao: "Ê, tập trung học nè!", co_len: "Đừng để điểm số chạy mất!", dinh_qua: "Làm một câu nữa đi!", qua_hay: "Nghỉ chút rồi chiến tiếp!", ban_gioi: "Quiz đang đợi kìa!", thu_gian: "Bạn làm được mà!", good_luck: "Cố lên nhé!", tuyet_voi: "Tuyệt vời!" };

export function PlayfulReactionOverlay() {
  const [message, setMessage] = useState("");
  useEffect(() => { const supabase = createSupabaseBrowserClient(); let channel: ReturnType<typeof supabase.channel> | undefined; let timer = 0; const show = (reactionId: unknown) => { if (!PRESET_REACTION_IDS.includes(reactionId as PresetReactionId)) return; window.clearTimeout(timer); setMessage(copy[reactionId as PresetReactionId]); timer = window.setTimeout(() => setMessage(""), 3000); };
    void supabase.auth.getUser().then(({ data }) => { if (!data.user) return; channel = supabase.channel(`social-reactions:${data.user.id}`, { config: { private: true } }).on("broadcast", { event: "reaction" }, ({ payload }) => show(payload?.reactionId)).subscribe(); });
    const touch = () => { if (document.visibilityState === "visible") void touchSocialActivity().catch(() => undefined); }; touch(); window.addEventListener("focus", touch); document.addEventListener("visibilitychange", touch); const interval = window.setInterval(touch, 60000); return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener("focus", touch); document.removeEventListener("visibilitychange", touch); if (channel) void supabase.removeChannel(channel); };
  }, []);
  return message ? <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-end p-6" role="status" aria-live="polite"><p className="friends-reaction rounded-full bg-primary px-5 py-3 font-heading text-sm font-bold text-primary-foreground shadow-xl motion-reduce:animate-none">{message}</p></div> : null;
}
