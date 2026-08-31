import type { MetadataRoute } from "next";

import { GUIDES } from "@/lib/content/guides";
import { MODULE_REFERENCES } from "@/lib/content/modules";

/**
 * The builder, learning content, module references, and licence notices.
 *
 * `lastModified` is deliberately absent rather than `new Date()`, which would
 * claim the site changed on every build and teach crawlers to ignore the
 * field.
 */
export const dynamic = "force-static";

const SITE = "https://starship.ndl.au";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/guides/`, changeFrequency: "monthly", priority: 0.8 },
    ...GUIDES.map((guide) => ({
      url: `${SITE}/guides/${guide.slug}/`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE}/modules/`, changeFrequency: "monthly", priority: 0.8 },
    ...MODULE_REFERENCES.map((reference) => ({
      url: `${SITE}/modules/${reference.slug}/`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${SITE}/licences/`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
