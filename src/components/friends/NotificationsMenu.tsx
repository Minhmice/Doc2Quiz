"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale/LocaleProvider";
import { acceptStudyChallenge, archiveChallengeInvite, declineStudyChallenge, markAllChallengeNotificationsRead, markChallengeNotificationRead, startOrResumeCreatorAttempt, type ChallengeNotification } from "@/lib/client/studyTogether";
import type { SocialCountsSnapshot } from "@/lib/client/socialCounts";

export function NotificationsMenu({ notifications, reconcile }: { notifications: readonly ChallengeNotification[]; reconcile: () => Promise<SocialCountsSnapshot> }) {
  const { messages } = useLocale(); const copy = messages.studyTogether; const router = useRouter(); const [busy, setBusy] = useState("");
  const refresh = async () => { await reconcile(); };
  const markAll = async () => { setBusy("all"); try { await markAllChallengeNotificationsRead(); await refresh(); } finally { setBusy(""); } };
  const open = async (notification: ChallengeNotification) => { setBusy(notification.id); try { await markChallengeNotificationRead(notification.id); const attempt = notification.type === "study_challenge_received" ? await acceptStudyChallenge(notification.entityId) : await startOrResumeCreatorAttempt(notification.entityId); if (notification.type === "study_challenge_received") await archiveChallengeInvite(notification.entityId); await refresh(); router.push(attempt.playHref); } finally { setBusy(""); } };
  const decline = async (notification: ChallengeNotification) => { setBusy(notification.id); try { await declineStudyChallenge(notification.entityId); await archiveChallengeInvite(notification.entityId); await refresh(); } finally { setBusy(""); } };
  return <section aria-label={copy.notificationsLabel} className="space-y-3"><div className="flex justify-end"><Button variant="ghost" disabled={busy === "all"} onClick={() => void markAll()}>{copy.markAllRead}</Button></div>{notifications.map((notification) => <article key={notification.id} className="rounded-xl border p-3"><p className="font-medium">{typeof notification.payload.title === "string" ? notification.payload.title : copy.title}</p><div className="mt-3 flex gap-2"><Button disabled={Boolean(busy)} onClick={() => void open(notification)}>{notification.type === "study_challenge_received" ? copy.accept : copy.continue}</Button>{notification.type === "study_challenge_received" ? <Button variant="outline" disabled={Boolean(busy)} onClick={() => void decline(notification)}>{copy.decline}</Button> : null}</div></article>)}</section>;
}
