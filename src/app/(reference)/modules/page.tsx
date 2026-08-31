import type { Metadata } from "next";

import { ContentCard, ContentShell } from "@/components/site/ContentShell";
import { MODULE_REFERENCES } from "@/lib/content/modules";
import { MODULE_GROUPS, MODULE_META } from "@/lib/config/meta";

export const metadata: Metadata = {
  title: "Module reference",
  description: "Practical configuration references for the most-used Starship prompt modules.",
  alternates: { canonical: "/modules/" },
  openGraph: {
    title: "Starship module reference",
    description: "Examples, options, variables, and common adjustments for Starship modules.",
    url: "/modules/",
  },
};

export default function ModulesPage() {
  return (
    <ContentShell
      title="Module reference"
      description="Practical references for the modules people tune most: when each appears, a valid starting configuration, its important options and variables, and the adjustments that solve common prompt problems."
      path="/modules/"
      kind="CollectionPage"
    >
      <div className="flex flex-col gap-10">
        {MODULE_GROUPS.map((group) => {
          const references = MODULE_REFERENCES.filter(
            (reference) => MODULE_META[reference.moduleName]?.group === group,
          );
          return references.length > 0 ? (
            <section key={group}>
              <h2 className="text-lg font-semibold text-neutral-100">{group}</h2>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {references.map((reference) => (
                  <ContentCard
                    key={reference.slug}
                    href={`/modules/${reference.slug}`}
                    title={reference.title}
                  >
                    {reference.description}
                  </ContentCard>
                ))}
              </ul>
            </section>
          ) : null;
        })}
      </div>
    </ContentShell>
  );
}
