"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/locale/LocaleProvider";
import { createStudyChallenge, listEligibleChallengeQuizzes, startOrResumeCreatorAttempt, type EligibleChallengeQuiz, type StudyMode } from "@/lib/client/studyTogether";

export function StudyChallengeDialog({ open, onOpenChange, recipientId, quizzes = [] }: { open: boolean; onOpenChange: (open: boolean) => void; recipientId: string; quizzes?: readonly EligibleChallengeQuiz[] }) {
  const { messages } = useLocale();
  const copy = messages.studyTogether;
  const router = useRouter();
  const [source, setSource] = useState<readonly EligibleChallengeQuiz[]>(quizzes);
  const [sourceState, setSourceState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const eligible = source.filter((quiz) => quiz.status === "ready" && quiz.questionCount > 0);
  const [outputId, setOutputId] = useState(eligible[0]?.outputId ?? "");
  const [mode, setMode] = useState<StudyMode>("score");
  const [deadline, setDeadline] = useState("none");
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !recipientId) return;
    let active = true;
    setSourceState("loading");
    void listEligibleChallengeQuizzes().then((next) => {
      if (!active) return;
      setSource(next);
      setOutputId(next[0]?.outputId ?? "");
      setSourceState("ready");
    }).catch(() => {
      if (!active) return;
      setSource([]);
      setOutputId("");
      setSourceState("error");
    });
    return () => { active = false; };
  }, [open, recipientId]);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const days = deadline === "1" ? 1 : deadline === "3" ? 3 : deadline === "7" ? 7 : 0;
      const result = await createStudyChallenge({ recipientId, outputId, mode, deadlineAt: days ? new Date(Date.now() + days * 86400000).toISOString() : null, message: message.trim() || null, revealPolicy: "after_both_complete" });
      setSessionId(result.sessionId);
    } catch {
      setError(copy.unavailable);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      const attempt = await startOrResumeCreatorAttempt(sessionId);
      router.push(attempt.playHref);
    } catch {
      setError(copy.unavailable);
    } finally {
      setBusy(false);
    }
  };

  const form = <FieldGroup>
    <Field><FieldLabel htmlFor="challenge-quiz">{copy.chooseQuiz}</FieldLabel><FieldContent><Select value={outputId} onValueChange={(value) => setOutputId(value || "")}><SelectTrigger id="challenge-quiz" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{eligible.map((quiz) => <SelectItem key={quiz.outputId} value={quiz.outputId}>{quiz.title} ({quiz.questionCount})</SelectItem>)}</SelectGroup></SelectContent></Select></FieldContent></Field>
    <Field><FieldLabel htmlFor="challenge-mode">{copy.mode}</FieldLabel><FieldContent><Select value={mode} onValueChange={(value) => setMode((value ?? "score") as StudyMode)}><SelectTrigger id="challenge-mode" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="score">{copy.scoreMode}</SelectItem><SelectItem value="practice">{copy.practiceMode}</SelectItem></SelectGroup></SelectContent></Select></FieldContent></Field>
    <Field><FieldLabel htmlFor="challenge-deadline">{copy.deadline}</FieldLabel><FieldContent><Select value={deadline} onValueChange={(value) => setDeadline(value || "none")}><SelectTrigger id="challenge-deadline" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="none">{copy.noDeadline}</SelectItem><SelectItem value="1">{copy.oneDay}</SelectItem><SelectItem value="3">{copy.threeDays}</SelectItem><SelectItem value="7">{copy.sevenDays}</SelectItem></SelectGroup></SelectContent></Select></FieldContent></Field>
    <Field><FieldLabel htmlFor="challenge-message">{copy.optionalMessage}</FieldLabel><FieldContent><Textarea id="challenge-message" maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} /></FieldContent></Field>
  </FieldGroup>;
  const content = sessionId ? <div className="flex flex-col gap-4"><p>{copy.sent}</p><Button disabled={busy} onClick={() => void start()}>{copy.start}</Button></div> : sourceState === "loading" ? <p>{copy.loading}</p> : sourceState === "error" || eligible.length === 0 ? <p role="status" className="text-muted-foreground">{copy.unavailable}</p> : form;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>{content}{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}{!sessionId ? <DialogFooter><Button disabled={busy || !outputId || sourceState !== "ready"} onClick={() => void send()}>{copy.send}</Button></DialogFooter> : null}</DialogContent></Dialog>;
}
