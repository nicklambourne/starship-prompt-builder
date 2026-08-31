import type { Metadata } from "next";

import { ContentShell } from "@/components/site/ContentShell";
import { ModuleReferenceIndex } from "@/components/site/ModuleReferenceIndex";
import { MODULE_REFERENCES } from "@/lib/content/modules";
import { MODULE_GROUPS, MODULE_META } from "@/lib/config/meta";

export const metadata: Metadata = {
  title: "Module reference",
  description: "Search practical configuration references for every Starship prompt module.",
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
      description="Search every Starship module by name, purpose, or category. Each reference explains when it appears, gives a valid starting configuration, and lists its options and format variables."
      path="/modules/"
      kind="CollectionPage"
    >
      <ModuleReferenceIndex
        groups={MODULE_GROUPS}
        modules={MODULE_REFERENCES.map((reference) => ({
          slug: reference.slug,
          moduleName: reference.moduleName,
          title: reference.title,
          description: reference.description,
          group: MODULE_META[reference.moduleName].group,
        }))}
      />
    </ContentShell>
  );
}
