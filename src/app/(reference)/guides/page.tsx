import type { Metadata } from "next";

import { ContentCard, ContentShell } from "@/components/site/ContentShell";
import { GUIDES } from "@/lib/content/guides";

export const metadata: Metadata = {
  title: "Guides",
  description: "Practical guides to building, importing, formatting, styling, and extending a Starship prompt.",
  alternates: { canonical: "/guides/" },
  openGraph: {
    title: "Starship Prompt Builder guides",
    description: "Practical guides to building and understanding starship.toml.",
    url: "/guides/",
  },
};

export default function GuidesPage() {
  return (
    <ContentShell
      title="Guides"
      description="Build a prompt from scratch, bring an existing config with you, or learn the two compact languages—format and style strings—that make Starship flexible."
      path="/guides/"
      showBreadcrumb={false}
      kind="CollectionPage"
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {GUIDES.map((guide) => (
          <ContentCard
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            title={guide.title}
          >
            {guide.summary}
          </ContentCard>
        ))}
      </ul>
    </ContentShell>
  );
}
