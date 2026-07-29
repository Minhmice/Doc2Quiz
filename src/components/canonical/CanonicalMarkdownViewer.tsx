import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { CanonicalSection } from "@/lib/client/canonicalizeStudySet";
import { cn } from "@/lib/utils";

export type CanonicalMarkdownViewerProps = Readonly<{
  markdown: string;
  sections?: CanonicalSection[];
  className?: string;
}>;

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-chart-2 underline-offset-2 hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ children, ...props }) => (
    <h1
      className="font-heading text-2xl font-extrabold tracking-tight"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="font-heading text-2xl font-extrabold tracking-tight"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="font-heading text-2xl font-extrabold tracking-tight"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-sm font-extrabold" {...props}>{children}</h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-sm font-extrabold" {...props}>{children}</h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-sm font-extrabold" {...props}>{children}</h6>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed" {...props}>{children}</p>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm leading-relaxed" {...props}>{children}</li>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-2 py-1 text-sm" {...props}>
      {children}
    </td>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-border px-2 py-1 text-left text-sm font-extrabold"
      {...props}
    >
      {children}
    </th>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-sm"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-muted px-1 font-mono text-sm"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
};

function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

export function CanonicalMarkdownViewer({
  markdown,
  sections,
  className,
}: CanonicalMarkdownViewerProps) {
  const hasSections = sections && sections.length > 0;

  return (
    <div
      className={cn(
        "d2q-prose max-w-[72ch] select-text text-foreground",
        className,
      )}
    >
      {hasSections
        ? sections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.ordinal}`}
              className="scroll-mt-20 space-y-3 not-last:mb-8"
            >
              {section.heading ? (
                <h2 className="font-heading text-2xl font-extrabold tracking-tight">
                  {section.heading}
                </h2>
              ) : null}
              {section.bodyMarkdown ? (
                <MarkdownBlock content={section.bodyMarkdown} />
              ) : null}
            </section>
          ))
        : markdown
          ? <MarkdownBlock content={markdown} />
          : null}
    </div>
  );
}
