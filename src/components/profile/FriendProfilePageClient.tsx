"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, Flame, UserRound } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";

type SharedQuiz = {
  id: string;
  title: string;
  type: "quiz";
  questionCount: number;
  updatedAt: string;
};

type FriendProfile = {
  displayName: string;
  username: string | null;
  bio: string;
  avatarUrl: string | null;
  currentStreak: number;
  quizzes: SharedQuiz[];
};

function formatUpdatedAt(value: string, fallback: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function FriendProfilePageClient({ userId }: { userId: string }) {
  const { messages } = useLocale();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    fetch(`/api/friends/profile/${userId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("profile_unavailable");
        const body = (await response.json()) as { data: FriendProfile };
        setProfile(body.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [userId]);

  if (status === "loading") return <div className="mx-auto w-full max-w-3xl py-16 text-sm text-muted-foreground" role="status">{messages.profile.loading}</div>;
  if (!profile) return <div className="mx-auto w-full max-w-3xl py-16" role="alert"><h1 className="font-heading text-2xl font-bold">{messages.profile.unavailable}</h1><p className="mt-2 text-muted-foreground">{messages.profile.friendOnly}</p></div>;

  const initials = (profile.displayName.trim()[0] ?? "S").toUpperCase();
  return <main className="mx-auto w-full max-w-3xl space-y-8 pb-12">
    <header className="border-b border-border pb-7"><p className="font-label text-xs font-bold uppercase tracking-[0.18em] text-primary">{messages.profile.friendEyebrow}</p><h1 className="mt-3 font-heading text-4xl font-extrabold tracking-[-0.04em] sm:text-6xl">{profile.displayName}</h1><p className="mt-2 text-muted-foreground">{profile.username ? `@${profile.username}` : messages.profile.identityUnset}</p></header>
    <section className="flex gap-5 border border-border bg-card p-5 shadow-sm"><div className="flex size-28 shrink-0 items-center justify-center overflow-hidden border-2 border-primary bg-primary/10 text-5xl font-extrabold text-primary">{profile.avatarUrl && !avatarFailed ? <img src={profile.avatarUrl} alt={`${profile.displayName}'s avatar`} className="size-full object-cover" onError={() => setAvatarFailed(true)} /> : initials}</div><div className="min-w-0"><p className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">{messages.profile.currentlyLearning}</p><p className="mt-3 max-w-xl leading-7">{profile.bio || messages.profile.friendBioEmpty}</p><p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary"><Flame className="size-4" aria-hidden />{messages.profile.dayStreak(profile.currentStreak)}</p></div></section>
    <section aria-labelledby="shared-quizzes-heading" className="space-y-4"><div className="flex items-center justify-between gap-3"><div><p className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">{messages.studyTogether.title}</p><h2 id="shared-quizzes-heading" className="mt-1 font-heading text-2xl font-bold">{messages.profile.sharedQuizzes}</h2></div><BookOpen className="size-5 text-primary" aria-hidden /></div>{profile.quizzes.length === 0 ? <p className="border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">{messages.profile.noSharedQuizzes}</p> : <div className="grid gap-3 sm:grid-cols-2">{profile.quizzes.map((quiz) => <Link key={quiz.id} href={`/profile/${userId}/quizzes/${quiz.id}`} className="group border border-border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><span className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">Quiz</span><ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden /></div><h3 className="mt-4 line-clamp-2 font-heading text-lg font-bold">{quiz.title}</h3><div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{quiz.questionCount} {messages.profile.quizzes.toLowerCase()}</span><span className="flex items-center gap-1"><CalendarDays className="size-3" aria-hidden />{formatUpdatedAt(quiz.updatedAt, messages.profile.recentlyUpdated)}</span></div><p className="mt-4 text-sm font-semibold text-primary">{messages.profile.practiceReadOnly}</p></Link>)}</div>}</section>
    <p className="flex items-center gap-2 text-sm text-muted-foreground"><UserRound className="size-4" />Visible to accepted friends only.</p>
  </main>;
}
