"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ensureStudySetDb,
  getApprovedBank,
  listStudySetMetas,
} from "@/lib/db/studySetDb";

/**
 * Phase 38 — explicit user-triggered export of approved MCQs for offline eval/training.
 * One JSON object per line: `{ studySetId, question }`.
 */
export function ApprovedBankExportButton() {
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      await ensureStudySetDb();
      const metas = await listStudySetMetas();
      const lines: string[] = [];
      for (const m of metas) {
        const bank = await getApprovedBank(m.id);
        if (!bank?.questions?.length) {
          continue;
        }
        for (const q of bank.questions) {
          lines.push(JSON.stringify({ studySetId: m.id, question: q }));
        }
      }
      if (lines.length === 0) {
        window.alert("No approved questions to export.");
        return;
      }
      const blob = new Blob([lines.join("\n")], {
        type: "application/x-ndjson",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doc2quiz-approved-export-${new Date().toISOString().slice(0, 10)}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Download approved multiple-choice questions from all study sets on this device
        (JSON Lines). For research or external training only — see{" "}
        <span className="font-mono text-xs">docs/EVAL-quiz-style-criteria.md</span>.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void onExport()}
      >
        {busy ? "Exporting…" : "Export approved questions (JSONL)"}
      </Button>
    </div>
  );
}
