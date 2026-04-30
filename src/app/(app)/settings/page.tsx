import { ApprovedBankExportButton } from "@/components/settings/ApprovedBankExportButton";
import { DevEnginePanel } from "@/components/settings/DevEnginePanel";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-2">
      <div>
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Application
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          Document processing is configured on the server. API URLs, keys, and
          models are not stored in the browser.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-[var(--d2q-muted)]">
          Ask your administrator if uploads fail or processing is unavailable.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Data export
        </p>
        <h2 className="font-heading mt-1 text-lg font-semibold text-[var(--d2q-text)]">
          Training / evaluation
        </h2>
        <div className="mt-4">
          <ApprovedBankExportButton />
        </div>
      </div>
      <DevEnginePanel />
    </div>
  );
}
