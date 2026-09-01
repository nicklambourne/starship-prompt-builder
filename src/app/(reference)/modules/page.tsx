import type { Metadata } from "next";

import { ContentShell } from "@/components/site/ContentShell";
import { ModuleReferenceIndex } from "@/components/site/ModuleReferenceIndex";
import { MODULE_REFERENCES } from "@/lib/content/modules";
import { MODULE_GROUPS, MODULE_META } from "@/lib/config/meta";
import {
  PROMPT_COMPONENT_GROUP,
  PROMPT_COMPONENT_REFERENCES,
} from "@/lib/content/promptComponents";

export const metadata: Metadata = {
  title: "Module reference",
  description: "Search practical references for every Starship module and the prompt builder's format components.",
  alternates: { canonical: "/modules/" },
  openGraph: {
    title: "Starship module and prompt component reference",
    description: "Examples, options, variables, and guidance for Starship modules and prompt components.",
    url: "/modules/",
  },
};

export default function ModulesPage() {
  return (
    <ContentShell
      title="Module reference"
      description="Search every Starship module and the builder's prompt components by name, purpose, or category. Module pages explain when they appear and list their options; component pages explain the format syntax they generate."
      path="/modules/"
      showBreadcrumb={false}
      kind="CollectionPage"
    >
      <ModuleReferenceIndex
        groups={[PROMPT_COMPONENT_GROUP, ...MODULE_GROUPS]}
        references={[
          ...PROMPT_COMPONENT_REFERENCES.map((reference) => ({
            slug: reference.slug,
            moduleName: reference.componentName,
            title: reference.title,
            description: reference.description,
            group: reference.group,
            searchTerms: reference.searchTerms,
          })),
          ...MODULE_REFERENCES.map((reference) => ({
            slug: reference.slug,
            moduleName: reference.moduleName,
            title: reference.title,
            description: reference.description,
            group: MODULE_META[reference.moduleName].group,
          })),
        ]}
      />
    </ContentShell>
  );
}
