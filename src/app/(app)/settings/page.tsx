import { AiProviderForm } from "@/components/settings/AiProviderForm";

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
        Settings
      </h1>
      <p className="mt-1 text-sm text-[var(--d2q-muted)]">
        API keys and models apply to all study sets on this device.
      </p>
      <div className="mt-8 rounded-2xl border border-[var(--d2q-border)] bg-[var(--d2q-surface)] p-6 shadow-lg shadow-black/20">
        <AiProviderForm />
      </div>
    </div>
  );
}
