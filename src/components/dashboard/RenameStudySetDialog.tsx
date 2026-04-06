"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { putStudySetMeta } from "@/lib/db/studySetDb";
import type { StudySetMeta } from "@/types/studySet";

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
      setError("Title cannot be empty.");
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
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename study set</DialogTitle>
          <DialogDescription>
            Choose a new display name for this set.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-sm font-medium text-foreground" htmlFor="rename-title">
            Title
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
            placeholder="Study set name"
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
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
