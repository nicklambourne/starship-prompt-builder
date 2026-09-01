import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { TERMINAL_FONTS } from "@/lib/fonts";

const SITE = "https://starship.ndl.au";

export const CONTENT_LINK =
  "text-accent-300 underline underline-offset-2 hover:text-accent-200";

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label="Configuration example"
      className="overflow-x-auto rounded-lg border border-white/10 bg-neutral-950 p-4 text-sm leading-6 text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
    >
      <code style={{ fontFamily: TERMINAL_FONTS[0].stack }}>{children}</code>
    </pre>
  );
}

export function ContentCard({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-white/10 bg-neutral-900/40 p-4">
      <h2 className="text-base font-semibold text-neutral-100">
        <Link href={href} className={CONTENT_LINK}>
          {title}
        </Link>
      </h2>
      <p className="mt-2 text-sm leading-6 text-neutral-400">{children}</p>
    </li>
  );
}

export function ContentShell({
  title,
  description,
  path,
  parent,
  parentHref,
  showBreadcrumb = true,
  kind = "TechArticle",
  children,
}: {
  title: string;
  description: string;
  path: string;
  parent?: string;
  parentHref?: string;
  showBreadcrumb?: boolean;
  kind?: "TechArticle" | "CollectionPage";
  children: React.ReactNode;
}) {
  const url = `${SITE}${path}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": kind,
    headline: title,
    name: title,
    description,
    url,
    isPartOf: { "@type": "WebSite", name: "Starship Prompt Builder", url: SITE },
    about: { "@type": "SoftwareApplication", name: "Starship", url: "https://starship.rs" },
    author: { "@type": "Person", name: "Nicholas Lambourne", url: "https://ndl.au" },
  };

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
        {showBreadcrumb ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <li>
                <Link
                  href="/"
                  aria-label="Builder"
                  title="Builder"
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
                >
                  <Logo size={16} />
                </Link>
              </li>
              {parent && parentHref ? (
                <>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link href={parentHref} className={CONTENT_LINK}>
                      {parent}
                    </Link>
                  </li>
                </>
              ) : null}
              {parent ? (
                <>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page">{title}</li>
                </>
              ) : null}
            </ol>
          </nav>
        ) : null}

        <header className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-400">{description}</p>
        </header>

        {children}
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
