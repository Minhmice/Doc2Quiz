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
      className={`pointer-events-none fixed inset-0 z-0 ${className}`}
    />
  );
}
