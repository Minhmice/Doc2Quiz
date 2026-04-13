/**
 * Remove duplicated A–D / choice labels from model option strings.
 * UI already shows A/B/C/D badges separately (see McqOptionsPreview).
 */
export function stripLeadingChoiceLabel(text: string): string {
  let t = text.trim();
  for (let i = 0; i < 6; i++) {
    const next = t
      .replace(/^\(?[A-Da-d]\)?[.):：、]\s*/u, "")
      .replace(
        /^(?:đáp\s*án|phương\s*án)\s+[A-Da-d]\s*[.):：、]?\s*/iu,
        "",
      )
      .replace(
        /^(?:choice|answer|option)\s*[A-Da-d]\s*[.):：、]?\s*/iu,
        "",
      )
      .trim();
    if (next === t) {
      break;
    }
    t = next;
  }
  return t;
}
