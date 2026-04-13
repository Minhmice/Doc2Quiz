export function DashboardBlueprintDecor() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute bottom-0 left-1/4 top-0 w-px bg-border/10" />
      <div className="absolute bottom-0 left-3/4 top-0 w-px bg-border/10" />
      <div className="absolute left-0 right-0 top-1/3 h-px bg-border/10" />
      <div className="absolute left-0 right-0 top-2/3 h-px bg-border/10" />
    </div>
  );
}
