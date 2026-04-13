import { AiProviderForm } from "@/components/settings/AiProviderForm";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-2">
      <div>
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Connection
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          API keys and models apply to all study sets on this device.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <AiProviderForm />
      </div>
    </div>
  );
}
