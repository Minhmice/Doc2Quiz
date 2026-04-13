type QuizNewImportTechnicalBackdropProps = Readonly<{
  className?: string;
}>;

/**
 * Linear technical grid aligned with `example/Quiz/code.html` (40px), using theme border token.
 */
export function QuizNewImportTechnicalBackdrop({
  className = "",
}: QuizNewImportTechnicalBackdropProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 [background-image:linear-gradient(to_right,color-mix(in_srgb,var(--border)_14%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--border)_14%,transparent)_1px,transparent_1px)] [background-size:40px_40px] ${className}`}
    />
  );
}
