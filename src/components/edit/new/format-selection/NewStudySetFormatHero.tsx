export type NewStudySetFormatHeroProps = Readonly<{
  title?: string;
  description?: string;
}>;

const DEFAULT_TITLE = "Pick your study format";
const DEFAULT_DESCRIPTION =
  "Choose how you want to study. Paste or upload plain text to generate a practice set.";

export function NewStudySetFormatHero({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: NewStudySetFormatHeroProps) {
  return (
    <section className="mb-5 max-w-5xl border-b border-border pb-5">
      <h1 className="mb-2 font-heading text-3xl leading-[1.08] font-extrabold tracking-[-0.03em] text-accent-foreground sm:text-5xl md:text-6xl">
        {title}
      </h1>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
    </section>
  );
}
