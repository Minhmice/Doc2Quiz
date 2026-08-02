"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/locale/LocaleProvider";

const steps = ["name", "identity", "commitment", "coach"] as const;
type Form = { displayName: string; studyIdentity: string; commitment: string; preferredStudyTime?: string; coachMode: string };

export function OnboardingClient() {
  const { messages } = useLocale();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ displayName: "", studyIdentity: "", commitment: "", coachMode: "balanced" });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const current = steps[step];
  const progress = useMemo(() => `${step + 1} / ${steps.length}`, [step]);
  useEffect(() => {
    const cached = localStorage.getItem("doc2quiz-onboarding");
    if (!cached) return;
    try {
      const parsed: unknown = JSON.parse(cached);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setForm((old) => ({ ...old, ...parsed }));
      }
    } catch {
      localStorage.removeItem("doc2quiz-onboarding");
    }
  }, []);
  const set = (key: keyof Form, value: string) => setForm((old) => { const next = { ...old, [key]: value }; localStorage.setItem("doc2quiz-onboarding", JSON.stringify(next)); return next; });
  async function next() {
    if (current === "name" && !form.displayName.trim()) return;
    if (step < steps.length - 1) return setStep(step + 1);
    setBusy(true);
    setSaveError("");
    try {
      const payload = { displayName: form.displayName, coachMode: form.coachMode, onboardingVersion: 1, onboardingCompleted: true, ...(form.studyIdentity && { studyIdentity: form.studyIdentity }), ...(form.commitment && { commitment: form.commitment }), ...(form.preferredStudyTime && { preferredStudyTime: form.preferredStudyTime }) };
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("save failed");
      localStorage.removeItem("doc2quiz-onboarding");
      window.location.assign("/create");
    } catch {
      setSaveError(messages.onboarding.saveError);
      setBusy(false);
    }
  }
  function skip() {
    if (step < steps.length - 1) setStep(step + 1);
  }
  return <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-12"><section className="w-full space-y-8" aria-live="polite"><div className="space-y-3"><p className="font-label text-xs uppercase tracking-[0.2em] text-muted-foreground">{messages.onboarding.eyebrow(progress)}</p><div className="h-1 bg-muted"><div className="h-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div><h1 className="font-heading text-4xl font-extrabold">{current === "name" ? messages.onboarding.nameTitle : current === "identity" ? messages.onboarding.identityTitle : current === "commitment" ? messages.onboarding.commitmentTitle : messages.onboarding.coachTitle}</h1></div>{current === "name" && <Input autoFocus value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder={messages.onboarding.namePlaceholder} maxLength={40} />}{current === "identity" && <div className="grid gap-3 sm:grid-cols-2">{(["exams", "university", "certifications", "work_skills", "personal_learning", "unknown"] as const).map((value) => <button type="button" key={value} onClick={() => set("studyIdentity", value)} className={`rounded-sm border p-4 text-left ${form.studyIdentity === value ? "border-primary bg-primary/10" : ""}`}>{messages.onboarding.identities[value]}</button>)}</div>}{current === "commitment" && <div className="grid gap-3 sm:grid-cols-3">{(["casual", "serious", "locked_in"] as const).map((value) => <button type="button" key={value} onClick={() => set("commitment", value)} className={`rounded-sm border p-4 text-left ${form.commitment === value ? "border-primary bg-primary/10" : ""}`}>{messages.onboarding.commitments[value]}</button>)}</div>}{current === "coach" && <div className="grid gap-3 sm:grid-cols-3">{(["aggressive", "balanced", "chill"] as const).map((value) => <button type="button" key={value} onClick={() => set("coachMode", value)} className={`rounded-sm border p-4 text-left ${form.coachMode === value ? "border-primary bg-primary/10" : ""}`}>{messages.onboarding.coachModes[value]}</button>)}</div>}{saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}<div className="flex justify-between"><Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>{messages.onboarding.back}</Button><div className="flex gap-2">{current !== "name" && <Button type="button" variant="ghost" disabled={busy} onClick={skip}>{messages.onboarding.skip}</Button>}<Button type="button" disabled={busy} onClick={() => void next()}>{step === steps.length - 1 ? messages.onboarding.startStudying : messages.onboarding.continue}</Button></div></div></section></main>;
}
