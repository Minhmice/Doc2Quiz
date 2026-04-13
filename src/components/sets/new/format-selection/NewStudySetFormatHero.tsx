export type NewStudySetFormatHeroProps = Readonly<{
  title?: string;
  description?: string;
}>;

const DEFAULT_TITLE = "Pick your study format";
const DEFAULT_DESCRIPTION =
  "Choose how you want to study. Upload a PDF to generate a practice set.";

export function NewStudySetFormatHero({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: NewStudySetFormatHeroProps) {
  return (
    <section className="mb-8 max-w-3xl">
      <h1 className="mb-3 font-heading text-4xl leading-tight font-extrabold tracking-tight text-accent-foreground md:text-5xl">
        {title}
      </h1>
      <p className="max-w-xl text-base text-muted-foreground">{description}</p>
    </section>
  );
}
