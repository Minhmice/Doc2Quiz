"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/buttons/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { putStudySetMeta } from "@/lib/client/studySetDb";
import type { StudySetMeta } from "@/types/studySet";
import { useLocale } from "@/components/locale/LocaleProvider";

export type RenameStudySetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: StudySetMeta | null;
  onSaved: () => void;
};

export function RenameStudySetDialog({
  open,
  onOpenChange,
  meta,
  onSaved,
}: RenameStudySetDialogProps) {
  const { messages } = useLocale();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && meta) {
      setTitle(meta.title);
      setError(null);
    }
  }, [open, meta]);

  const handleSave = async () => {
    const next = title.trim();
    if (!meta || next.length === 0) {
      setError(messages.rename.empty);
      return;
    }
    if (next === meta.title) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await putStudySetMeta({
        ...meta,
        title: next,
        updatedAt: new Date().toISOString(),
      });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.rename.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{messages.rename.title}</DialogTitle>
          <DialogDescription>
            {messages.rename.description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-sm font-medium text-foreground" htmlFor="rename-title">
            {messages.rename.label}
          </label>
          <Input
            id="rename-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            placeholder={messages.rename.placeholder}
            autoFocus
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {messages.rename.cancel}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? messages.rename.saving : messages.rename.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
