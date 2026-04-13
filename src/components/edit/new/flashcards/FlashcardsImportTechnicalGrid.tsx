export type FlashcardsImportTechnicalGridProps = {
  /** Optional class for z-index stacking */
  className?: string;
};

/**
 * Full-viewport technical grid overlay (Quiz example parity) using theme-aware lines.
 */
export function FlashcardsImportTechnicalGrid({
  className = "",
}: Readonly<FlashcardsImportTechnicalGridProps>) {
  const line = "color-mix(in srgb, var(--border) 16%, transparent)";
  return (
    <div
      aria-hidden
      style={{
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
      className={`pointer-events-none fixed inset-0 z-0 ${className}`}
    />
  );
}
