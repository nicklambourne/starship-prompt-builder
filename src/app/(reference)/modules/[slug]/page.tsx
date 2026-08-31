import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CodeBlock,
  CONTENT_LINK,
  ContentShell,
} from "@/components/site/ContentShell";
import { ModulePreview } from "@/components/site/ModulePreview";
import { MODULE_META } from "@/lib/config/meta";
import { optionDoc } from "@/lib/config/options";
import { getModuleSchema } from "@/lib/config/schema";
import { variableDoc } from "@/lib/config/variables";
import {
  MODULE_REFERENCES,
  moduleBuilderHref,
  moduleReferenceBySlug,
} from "@/lib/content/modules";

export const dynamicParams = false;

export function generateStaticParams() {
  return MODULE_REFERENCES.map((reference) => ({ slug: reference.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const reference = moduleReferenceBySlug(slug);
  if (!reference) return {};
  return {
    title: reference.title,
    description: reference.description,
    alternates: { canonical: `/modules/${reference.slug}/` },
    openGraph: {
      title: `${reference.title} configuration`,
      description: reference.description,
      url: `/modules/${reference.slug}/`,
      type: "article",
    },
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const reference = moduleReferenceBySlug(slug);
  if (!reference) notFound();

  const schema = getModuleSchema(reference.moduleName);
  const options = reference.keyOptions.map((key) => {
    const option = schema?.options.find((candidate) => candidate.key === key);
    const documentation = optionDoc(reference.moduleName, key);
    return {
      key,
      type: option?.type ?? "unknown",
      description:
        documentation?.description ??
        option?.description ??
        "A Starship option for this module.",
    };
  });
  const meta = MODULE_META[reference.moduleName];

  return (
    <ContentShell
      title={reference.title}
      description={reference.description}
      path={`/modules/${reference.slug}/`}
      parent="Module reference"
      parentHref="/modules"
    >
      <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-10">
          <section>
            <h2 className="text-xl font-semibold text-neutral-100">When it appears</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-400">{reference.when}</p>
          </section>

          <ModulePreview reference={reference} />

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-neutral-100">Starting configuration</h2>
            <CodeBlock>{reference.example}</CodeBlock>
            <a
              href={moduleBuilderHref(reference)}
              aria-label={`Open ${reference.title.replace(" module", "").toLowerCase()} in the builder`}
              className="inline-flex w-fit rounded border border-accent-400 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
            >
              Open in the builder
            </a>
            <p className="text-xs leading-5 text-neutral-500">
              The configuration is compressed into the URL fragment and stays in
              your browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-100">Key options</h2>
            <dl className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10 bg-neutral-900/40">
              {options.map((option) => (
                <div key={option.key} className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]">
                  <dt className="font-mono text-sm text-neutral-200">
                    {option.key}
                    <span className="ml-2 font-sans text-xs text-neutral-500">
                      {option.type}
                    </span>
                  </dt>
                  <dd className="text-sm leading-6 text-neutral-400">{option.description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-100">Format variables</h2>
            {reference.variables.length > 0 ? (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {reference.variables.map((variable) => (
                  <div
                    key={variable}
                    className="rounded-xl border border-white/10 bg-neutral-900/40 p-4"
                  >
                    <dt className="font-mono text-sm text-neutral-200">${variable}</dt>
                    <dd className="mt-2 text-sm leading-6 text-neutral-400">
                      {variableDoc(reference.moduleName, variable)?.description ??
                        "A value available to this module's format."}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm leading-7 text-neutral-400">
                Starship does not document format variables for this module.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-100">Common adjustments</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-neutral-400">
              {reference.adjustments.map((adjustment) => (
                <li key={adjustment}>{adjustment}</li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-5 rounded-xl border border-white/10 bg-neutral-900/40 p-5 lg:sticky lg:top-24">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Starship key</h2>
            <code className="mt-2 block text-sm text-neutral-300">
              {reference.moduleName === "custom" || reference.moduleName === "env_var"
                ? `[${reference.moduleName}.<name>]`
                : `[${reference.moduleName}]`}
            </code>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Category</h2>
            <p className="mt-2 text-sm text-neutral-400">{meta?.group}</p>
          </div>
          <a
            href={meta?.docs}
            target="_blank"
            rel="noreferrer noopener"
            className={CONTENT_LINK}
          >
            Official Starship documentation
          </a>
          {reference.related.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">Related modules</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {reference.related.map((relatedSlug) => {
                  const related = moduleReferenceBySlug(relatedSlug);
                  return related ? (
                    <li key={related.slug}>
                      <Link href={`/modules/${related.slug}`} className={CONTENT_LINK}>
                        {related.title}
                      </Link>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          ) : null}
        </aside>
      </article>
    </ContentShell>
  );
}
