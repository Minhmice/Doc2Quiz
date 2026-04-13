"use client";

import { Button } from "@/components/buttons/button";

type Props = {
  isRunning: boolean;
  unifiedParseDisabled: boolean;
  onParse: () => void;
  onCancel: () => void;
};

export function AiParseActions({
  isRunning,
  unifiedParseDisabled,
  onParse,
  onCancel,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
      <Button
        type="button"
        onClick={() => void onParse()}
        disabled={unifiedParseDisabled}
      >
        Parse
      </Button>
      {isRunning ? (
        <Button type="button" variant="destructive" onClick={onCancel}>
          Cancel parsing (stop AI processing)
        </Button>
      ) : null}
    </div>
  );
}
