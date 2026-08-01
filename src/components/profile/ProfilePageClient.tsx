"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Award, BookOpen, Check, FileText, ImagePlus, Layers3, Shield, Upload, X } from "lucide-react";
import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import { buildProfileAvatarPath, validateProfileImage } from "@/lib/profile/profileValidation";

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
  const { refreshAvatar, setDisplayName } = useDisplayName();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ displayName: "", username: "", bio: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("loading");
  const [avatarMenu, setAvatarMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then(async (response) => {
      if (!response.ok) throw new Error("Profile unavailable");
      const body = (await response.json()) as { data: Profile };
      setProfile(body.data);
      setForm({ displayName: body.data.displayName, username: body.data.username ?? "", bio: body.data.bio });
      setStatus("idle");
    }).catch(() => setStatus("error"));
  }, []);

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const validationError = validateProfileImage(file);
      if (validationError) throw new Error(validationError);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again before uploading an avatar.");
      const path = buildProfileAvatarPath(user.id, file.type);
      if (!path) throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
      const { error } = await supabase.storage.from("doc2quiz").upload(path, file, { contentType: file.type, upsert: true, cacheControl: "3600" });
      if (error) throw new Error("Avatar upload failed. Try again.");
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarPath: path }) });
      if (!response.ok) throw new Error("Avatar uploaded, but profile save failed. Try again.");
      const avatarUrl = await refreshAvatar();
      if (!avatarUrl) throw new Error("Avatar saved, but private preview could not load. Refresh and try again.");
      setProfile((current) => current ? { ...current, avatarUrl } : current);
      setAvatarFailed(false);
      setAvatarMenu(false);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Avatar upload failed. Try again."); }
    finally { setUploading(false); }
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatus("loading");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error("Save failed");
      const body = (await response.json()) as { data: { display_name?: string | null; bio?: string | null; username?: string | null } };
      const next = { ...form, displayName: body.data.display_name ?? form.displayName, bio: body.data.bio ?? form.bio, username: body.data.username ?? form.username };
      setForm(next); setProfile((current) => current ? { ...current, displayName: next.displayName, bio: next.bio, username: next.username || null } : current); setDisplayName(next.displayName); setStatus("saved");
    } catch { setStatus("error"); }
  };

  if (status === "loading" && !profile) return <div className="mx-auto w-full max-w-6xl py-16 text-sm text-muted-foreground" role="status">Loading profile…</div>;
  if (!profile) return <div className="mx-auto w-full max-w-6xl py-16" role="alert"><h1 className="font-heading text-2xl font-bold">Profile unavailable</h1><p className="mt-2 text-muted-foreground">Refresh page and try again.</p></div>;

  const initials = (profile.displayName.trim()[0] ?? "S").toUpperCase();
  const stats = [{ label: "Study sets", value: profile.stats.total, icon: Layers3 }, { label: "Quizzes", value: profile.stats.quiz, icon: BookOpen }, { label: "Flashcards", value: profile.stats.flashcards, icon: FileText }];
  return <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
    <header className="border-b border-border pb-7"><p className="font-label text-xs font-bold uppercase tracking-[0.18em] text-primary">Player profile / Doc2Quiz</p><h1 className="mt-3 font-heading text-4xl font-extrabold tracking-[-0.04em] sm:text-6xl">{profile.displayName}</h1><p className="mt-2 text-muted-foreground">{profile.username ? `@${profile.username}` : "Learning identity not configured"}</p></header>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(250px,3fr)]">
      <main className="space-y-6">
        <section className="relative flex gap-5 border border-border bg-card p-5 shadow-sm"><div className="relative"><button type="button" onClick={() => setAvatarMenu((open) => !open)} className="flex size-28 items-center justify-center border-2 border-primary bg-primary/10 text-5xl font-extrabold text-primary shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_25%,transparent)]" aria-label="Open avatar menu">{profile.avatarUrl && !avatarFailed ? <img src={profile.avatarUrl} alt={`${profile.displayName}'s avatar`} className="size-full object-cover" onError={() => setAvatarFailed(true)} /> : initials}</button>{avatarMenu && <div className="absolute left-0 top-full z-10 mt-2 w-52 border border-border bg-popover p-2 shadow-lg"><button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2 p-2 text-left text-sm font-semibold hover:bg-muted"><ImagePlus className="size-4" />Choose avatar</button>{profile.avatarUrl && <button type="button" onClick={() => { setProfile({ ...profile, avatarUrl: null }); setAvatarMenu(false); }} className="flex w-full items-center gap-2 p-2 text-left text-sm text-destructive hover:bg-muted"><X className="size-4" />Remove preview</button>}</div>}<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.target.value = ""; }} /></div><div><p className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">Currently learning</p><p className="mt-3 max-w-xl leading-7">{profile.bio || "Build your learning profile and showcase your progress."}</p>{uploading && <p className="mt-3 flex items-center gap-2 text-sm text-primary"><Upload className="size-4 animate-pulse" />Uploading avatar…</p>}{uploadError && <p className="mt-3 text-sm text-destructive" role="alert">{uploadError}</p>}</div></section>
        <section className="border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-xl font-bold">Showcase</h2><span className="font-label text-xs text-muted-foreground">Learning highlights</span></div><div className="grid gap-4 sm:grid-cols-2"><div className="min-h-44 border border-primary/30 bg-primary/5 p-5"><p className="font-label text-xs text-primary">Featured collection</p><h3 className="mt-8 font-heading text-2xl font-bold">Your study library</h3><p className="mt-2 text-sm text-muted-foreground">{profile.stats.total} study sets ready for your next session.</p><Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">Open library <ArrowUpRight className="size-4" /></Link></div><div className="min-h-44 border border-border p-5"><p className="font-label text-xs text-muted-foreground">Completion rate</p><strong className="mt-8 block font-heading text-5xl">{profile.stats.total ? Math.round((profile.stats.ready / profile.stats.total) * 100) : 0}%</strong><p className="mt-2 text-sm text-muted-foreground">sets converted into playable material</p></div></div></section>
        <form onSubmit={save} className="space-y-5 border border-border bg-card p-5"><h2 className="font-heading text-xl font-bold">Edit profile</h2><label className="block text-sm font-semibold">Display name<Input className="mt-2 min-h-11" value={form.displayName} maxLength={40} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></label><label className="block text-sm font-semibold">Username<Input className="mt-2 min-h-11" value={form.username} maxLength={30} placeholder="your_username" onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label className="block text-sm font-semibold">Bio<Textarea className="mt-2 min-h-24 resize-y" value={form.bio} maxLength={160} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label><div className="flex items-center gap-4"><Button type="submit" disabled={status === "loading"}>{status === "loading" ? "Saving…" : "Save changes"}</Button>{status === "saved" && <span className="flex items-center gap-1 text-sm font-semibold text-primary"><Check className="size-4" />Saved</span>}{status === "error" && <span className="text-sm text-destructive">Could not save.</span>}</div></form>
      </main>
      <aside className="space-y-5"><section className="border border-border bg-card p-5"><h2 className="font-heading text-xl font-bold">Profile Awards</h2><div className="mt-4 grid grid-cols-3 gap-2">{["XP", "FOCUS", "READY"].map((award) => <div key={award} className="flex aspect-square items-center justify-center border border-primary/40 bg-primary/10 text-center font-label text-[10px] font-bold text-primary">{award}</div>)}</div></section><section className="border border-border bg-card p-5"><h2 className="font-heading text-xl font-bold">Badges</h2><div className="mt-4 space-y-4">{badges.map(({ label, detail, icon: Icon }) => <div key={label} className="flex items-center gap-3"><div className="flex size-10 items-center justify-center border border-border bg-muted text-primary"><Icon className="size-5" /></div><div><p className="text-sm font-bold">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>)}</div></section><section className="border-y border-border"><h2 className="py-3 font-heading text-xl font-bold">Stats</h2>{stats.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center justify-between border-t border-border py-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 text-primary" />{label}</span><strong>{value}</strong></div>)}</section></aside>
    </div>
  </div>;
}
