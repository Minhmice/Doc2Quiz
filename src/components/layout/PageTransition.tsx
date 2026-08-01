type PageTransitionProps = {
  children: React.ReactNode;
};

/** Route segment wrapper — no enter animation; keeps sticky layout behavior. */
export function PageTransition({ children }: PageTransitionProps) {
  return <div className="flex w-full min-w-0 flex-col">{children}</div>;
}
