"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/components/locale/LocaleProvider";

type FriendProfile = {
  displayName: string;
  username: string | null;
  bio: string;
  avatarUrl: string | null;
};

export function FriendProfilePageClient({ userId }: { userId: string }) {
  const { messages } = useLocale();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch(`/api/friends/profile/${userId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile_unavailable");
        const body = (await response.json()) as { data: FriendProfile };
        setProfile(body.data);
        setAvatarFailed(false);
        setStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [userId, loadAttempt]);

  if (status === "loading" && !profile) return <div className="w-full px-4 py-16 text-sm text-muted-foreground sm:px-6 lg:px-8" role="status" aria-live="polite">{messages.profile.loading}</div>;
  if (!profile) return <div className="w-full px-4 py-6 sm:px-6 lg:px-8"><Alert variant="destructive"><AlertTitle>{messages.profile.unavailable}</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{messages.profile.refresh}</span><AlertAction className="static"><Button type="button" variant="outline" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{messages.friends.retry}</Button></AlertAction></AlertDescription></Alert></div>;

  const initials = (profile.displayName.trim()[0] ?? "S").toUpperCase();
  return <main className="w-full min-w-0 space-y-6 px-4 py-6 pb-12 sm:px-6 lg:px-8">
    <header aria-label={messages.profile.publicEyebrow} className="flex min-w-0 flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words font-heading text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{profile.displayName}</h1>
        <p className="mt-2 break-words text-sm text-muted-foreground">{profile.username ? `@${profile.username}` : messages.profile.identityUnset}</p>
      </div>
      <p className="font-label text-xs font-bold uppercase tracking-[0.18em] text-primary">{messages.profile.publicEyebrow}</p>
    </header>
    <Card>
      <CardContent className="grid min-w-0 gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-8">
        <Avatar className="size-28 rounded-full border-2 border-primary bg-primary/10 text-5xl font-extrabold text-primary sm:size-36">
          <AvatarImage src={profile.avatarUrl && !avatarFailed ? profile.avatarUrl : undefined} alt={`${profile.displayName}'s avatar`} onError={() => setAvatarFailed(true)} />
          <AvatarFallback className="rounded-full bg-primary/10 text-5xl font-extrabold text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-4">
          <div>
            <p className="font-label text-xs font-bold uppercase tracking-[0.16em] text-primary">{messages.profile.bio}</p>
            <p className="mt-3 max-w-3xl break-words text-base leading-7 text-foreground/90">{profile.bio || messages.profile.friendBioEmpty}</p>
          </div>
          <p className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>{messages.profile.publicProfileNote}</span></p>
        </div>
      </CardContent>
    </Card>
  </main>;
}
