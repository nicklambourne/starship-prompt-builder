import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CodeBlock,
  CONTENT_LINK,
  ContentShell,
} from "@/components/site/ContentShell";
import { GUIDES, guideBySlug } from "@/lib/content/guides";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}/` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `/guides/${guide.slug}/`,
      type: "article",
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  return (
    <ContentShell
      title={guide.title}
      description={guide.summary}
      path={`/guides/${guide.slug}/`}
      parent="Guides"
      parentHref="/guides"
    >
      <article className="flex max-w-3xl flex-col gap-10">
        {guide.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-100">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-neutral-400">
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-neutral-400">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.code ? <CodeBlock>{section.code}</CodeBlock> : null}
          </section>
        ))}

        <aside className="rounded-xl border border-accent-400/40 bg-accent-500/5 p-5">
          <h2 className="text-base font-semibold text-neutral-100">Try it visually</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            The builder keeps your configuration in this browser and exports ordinary
            starship.toml.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded border border-accent-400 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            Open the builder
          </Link>
        </aside>

        <section>
          <h2 className="text-base font-semibold text-neutral-100">Related guides</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {guide.related.map((relatedSlug) => {
              const related = guideBySlug(relatedSlug);
              return related ? (
                <li key={related.slug}>
                  <Link href={`/guides/${related.slug}`} className={CONTENT_LINK}>
                    {related.title}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      </article>
    </ContentShell>
  );
}
