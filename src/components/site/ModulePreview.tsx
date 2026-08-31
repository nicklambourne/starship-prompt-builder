import { ReferencePreview } from "@/components/site/ReferencePreview";
import type { ModuleReference } from "@/lib/content/modules";
import { renderModuleReferencePreview } from "@/lib/content/modulePreviews";

export function ModulePreview({ reference }: { reference: ModuleReference }) {
  const rendered = renderModuleReferencePreview(reference);

  return (
    <ReferencePreview
      rendered={rendered}
      description="Rendered from the starting configuration in a representative simulated environment."
    />
  );
}
