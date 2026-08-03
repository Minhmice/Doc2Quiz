"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Award, BookOpen, Check, FileText, ImagePlus, Layers3, Shield, X } from "lucide-react";
import { Button } from "@/components/buttons/button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { useLocale } from "@/components/locale/LocaleProvider";
import { validateProfileImage } from "@/lib/profile/profileValidation";

type Profile = {
  displayName: string;
  bio: string;
  username: string | null;
  avatarUrl: string | null;
  stats: { total: number; quiz: number; flashcards: number; ready: number };
};

const badges = [
  { label: "First steps", detail: "Created first study set", icon: BookOpen },
  { label: "Quiz architect", detail: "Completed 10 quizzes", icon: Award },
  { label: "Knowledge keeper", detail: "Built 25 flashcards", icon: Shield },
];

export function ProfilePageClient() {
  const { messages } = useLocale();
  const { setAvatarUrl, setDisplayName } = useDisplayName();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ displayName: "", username: "", bio: "" });
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus("loading");
    fetch("/api/profile", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("profile_unavailable");
      const body = (await response.json()) as { data: Profile };
      setProfile(body.data);
      setForm({ displayName: body.data.displayName, username: body.data.username ?? "", bio: body.data.bio });
      setAvatarFailed(false);
      setLoadStatus("ready");
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadStatus("error");
    });
    return () => controller.abort();
  }, [loadAttempt]);

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const validationError = validateProfileImage(file);
      if (validationError) throw new Error(validationError);
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/profile", { method: "POST", body: form });
      const body = await response.json().catch(() => null) as { data?: { avatarUrl?: string }; error?: string } | null;
      if (!response.ok) {
        if (response.status === 401) throw new Error(messages.profile.avatarUploadAuth);
        throw new Error(body?.error || messages.profile.avatarUploadFailed);
      }
      const avatarUrl = body?.data?.avatarUrl;
      if (!avatarUrl) throw new Error(messages.profile.avatarPreviewFailed);
      setProfile((current) => current ? { ...current, avatarUrl } : current);
      setAvatarUrl(avatarUrl);
      setAvatarFailed(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : messages.profile.avatarUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveStatus("loading");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error("Save failed");
      const body = (await response.json()) as { data: { display_name?: string | null; bio?: string | null; username?: string | null } };
      const next = { ...form, displayName: body.data.display_name ?? form.displayName, bio: body.data.bio ?? form.bio, username: body.data.username ?? form.username };
      setForm(next);
      setProfile((current) => current ? { ...current, displayName: next.displayName, bio: next.bio, username: next.username || null } : current);
      setDisplayName(next.displayName);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  if (loadStatus === "loading" && !profile) return <div className="w-full px-4 py-16 text-sm text-muted-foreground sm:px-6 lg:px-8" role="status" aria-live="polite">{messages.profile.loading}</div>;
  if (!profile) return <div className="w-full px-4 py-6 sm:px-6 lg:px-8"><Alert variant="destructive"><AlertTitle>{messages.profile.unavailable}</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{messages.profile.refresh}</span><AlertAction className="static"><Button type="button" variant="outline" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{messages.friends.retry}</Button></AlertAction></AlertDescription></Alert></div>;

  const initials = (profile.displayName.trim()[0] ?? "S").toUpperCase();
  const stats = [{ label: messages.profile.studySets, value: profile.stats.total, icon: Layers3 }, { label: messages.profile.quizzes, value: profile.stats.quiz, icon: BookOpen }, { label: messages.profile.flashcards, value: profile.stats.flashcards, icon: FileText }];
  return <div className="w-full min-w-0 space-y-6 px-4 py-6 pb-8 sm:px-6 lg:px-8">
    <header className="flex min-w-0 flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words font-heading text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{profile.displayName}</h1>
        <p className="mt-2 break-words text-sm text-muted-foreground">{profile.username ? `@${profile.username}` : messages.profile.identityUnset}</p>
      </div>
      <p className="font-label text-xs font-bold uppercase tracking-[0.18em] text-primary">{messages.profile.playerEyebrow}</p>
    </header>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <main className="min-w-0 space-y-6">
        <Card>
          <CardContent className="flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="ghost" className="group/avatar-trigger relative size-24 rounded-full p-0 ring-2 ring-primary/25 transition-[transform,box-shadow] duration-200 hover:scale-[1.03] hover:ring-primary/50 focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-[0.98] motion-reduce:transition-none" aria-label={messages.profile.chooseAvatar} />}>
                  <Avatar className="size-24 rounded-full border-2 border-primary bg-primary/10 text-4xl font-extrabold text-primary">
                    <AvatarImage src={profile.avatarUrl && !avatarFailed ? profile.avatarUrl : undefined} alt={`${profile.displayName}'s avatar`} onError={() => setAvatarFailed(true)} />
                    <AvatarFallback className="rounded-full bg-primary/10 text-4xl font-extrabold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-full bg-foreground/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-background opacity-0 transition-opacity group-hover/avatar-trigger:opacity-100 motion-reduce:transition-none"><ImagePlus className="size-3" aria-hidden="true" />{messages.profile.chooseAvatar}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => fileRef.current?.click()}><ImagePlus />{messages.profile.chooseAvatar}</DropdownMenuItem>
                  {profile.avatarUrl ? <DropdownMenuItem variant="destructive" onClick={() => setProfile({ ...profile, avatarUrl: null })}><X />{messages.profile.removePreview}</DropdownMenuItem> : null}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs font-medium text-muted-foreground">{uploading ? messages.profile.uploadingAvatar : messages.profile.chooseAvatar}</span>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadAvatar(file); }} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-label text-xs font-bold uppercase tracking-[0.16em] text-primary">{messages.profile.currentlyLearning}</p>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{profile.bio || messages.profile.defaultBio}</p>
              </div>
              {uploadError ? <Alert variant="destructive"><AlertDescription>{uploadError}</AlertDescription></Alert> : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex flex-wrap items-baseline justify-between gap-2"><CardTitle>{messages.profile.showcase}</CardTitle><span className="font-label text-xs text-muted-foreground">{messages.profile.learningHighlights}</span></div></CardHeader>
          <CardContent className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-h-44 min-w-0 border border-primary/30 bg-primary/5 p-5">
              <p className="font-label text-xs text-primary">{messages.profile.featuredCollection}</p>
              <h2 className="mt-5 break-words font-heading text-xl font-bold">{messages.profile.studyLibrary}</h2>
              <p className="mt-2 break-words text-sm text-muted-foreground">{messages.profile.readySets(profile.stats.total)}</p>
              <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{messages.profile.openLibrary}<ArrowUpRight className="size-4" /></Link>
            </div>
            <div className="min-h-44 min-w-0 border border-border p-5">
              <p className="font-label text-xs text-muted-foreground">{messages.profile.completionRate}</p>
              <strong className="mt-5 block font-heading text-4xl">{profile.stats.total ? Math.round((profile.stats.ready / profile.stats.total) * 100) : 0}%</strong>
              <p className="mt-2 break-words text-sm text-muted-foreground">{messages.profile.playableMaterial}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{messages.profile.editProfile}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={save} className="flex min-w-0 flex-col gap-5">
              <FieldGroup>
                <Field><FieldLabel htmlFor="profile-display-name">{messages.settings.displayName}</FieldLabel><FieldContent><Input id="profile-display-name" className="min-h-11" value={form.displayName} maxLength={40} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></FieldContent></Field>
                <Field><FieldLabel htmlFor="profile-username">{messages.profile.username}</FieldLabel><FieldContent><Input id="profile-username" className="min-h-11" value={form.username} maxLength={30} placeholder="your_username" onChange={(e) => setForm({ ...form, username: e.target.value })} /></FieldContent></Field>
                <Field><FieldLabel htmlFor="profile-bio">{messages.profile.bio}</FieldLabel><FieldContent><Textarea id="profile-bio" className="min-h-24 resize-y" value={form.bio} maxLength={160} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></FieldContent></Field>
              </FieldGroup>
              <div className="flex flex-wrap items-center gap-3" aria-live="polite">
                <Button type="submit" disabled={saveStatus === "loading"}>{saveStatus === "loading" ? messages.profile.saving : messages.settings.saveChanges}</Button>
                {saveStatus === "saved" && <span className="flex items-center gap-1 text-sm font-semibold text-primary"><Check className="size-4" />{messages.profile.saved}</span>}
                {saveStatus === "error" && <span className="text-sm text-destructive">{messages.profile.couldNotSave}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
      <aside className="min-w-0 space-y-6 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader><CardTitle>{messages.profile.awards}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2"><div className="flex aspect-square items-center justify-center border border-primary/40 bg-primary/10 text-center font-label text-[10px] font-bold text-primary">XP</div><div className="flex aspect-square items-center justify-center border border-primary/40 bg-primary/10 text-center font-label text-[10px] font-bold text-primary">FOCUS</div><div className="flex aspect-square items-center justify-center border border-primary/40 bg-primary/10 text-center font-label text-[10px] font-bold text-primary">READY</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{messages.profile.badges}</CardTitle></CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4">{badges.map(({ label, detail, icon: Icon }) => <div key={label} className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center border border-border bg-muted text-primary"><Icon className="size-5" /></div><div className="min-w-0"><p className="break-words text-sm font-bold">{label}</p><p className="break-words text-xs text-muted-foreground">{detail}</p></div></div>)}</CardContent>
        </Card>
        <section className="border-y border-border"><h2 className="py-3 font-heading text-xl font-bold">{messages.profile.stats}</h2>{stats.map(({ label, value, icon: Icon }) => <div key={label} className="flex min-w-0 items-center justify-between gap-3 border-t border-border py-3"><span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 shrink-0 text-primary" /><span className="break-words">{label}</span></span><strong className="shrink-0">{value}</strong></div>)}</section>
      </aside>
    </div>
  </div>;
}
