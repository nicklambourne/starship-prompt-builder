import type { ReactNode } from "react";

import type { DocumentationLink } from "@/lib/config/documentation";

/**
 * Restores links stripped out of the plain-text description shown in a row.
 * The generated metadata keeps both the readable sentence and its targets;
 * matching by label lets the sentence remain compact without rendering
 * arbitrary Markdown in the client.
 */
export function DocumentationText({
  text,
  links = [],
}: {
  text: string;
  links?: DocumentationLink[];
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const [index, link] of links.entries()) {
    const start = text.indexOf(link.label, cursor);
    if (start < 0) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <a
        key={`${link.url}-${index}`}
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-white/30 underline-offset-2 hover:text-accent-200 hover:decoration-accent-300"
      >
        {link.label}
      </a>,
    );
    cursor = start + link.label.length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length > 0 ? parts : text;
}
