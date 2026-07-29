import type { ZodError } from "zod";

export function summarizeZodError(error: ZodError, maxIssues = 3): string {
  const issues = error.issues.slice(0, maxIssues).map((issue) => {
    const path =
      issue.path.length > 0 ? `${issue.path.map(String).join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
  const remaining = error.issues.length - issues.length;
  if (remaining > 0) {
    issues.push(`(+${remaining} more validation issues)`);
  }
  return issues.join("; ");
}
