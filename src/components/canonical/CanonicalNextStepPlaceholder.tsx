import { Button } from "@/components/ui/button";

const HELPER_ID = "canonical-next-step-helper";

export function CanonicalNextStepPlaceholder() {
  return (
    <footer
      className="rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/10"
      aria-labelledby="canonical-next-step-label"
    >
      <p
        id="canonical-next-step-label"
        className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground"
      >
        Next step
      </p>
      <div className="mt-3 space-y-2">
        <Button
          type="button"
          disabled
          aria-disabled="true"
          title="Available after canonical knowledge is saved"
          aria-describedby={HELPER_ID}
          className="cursor-not-allowed opacity-50"
        >
          Choose learning mode
        </Button>
        <p id={HELPER_ID} className="text-sm text-muted-foreground">
          Choose learning mode next — quiz or flashcards.
        </p>
      </div>
    </footer>
  );
}
