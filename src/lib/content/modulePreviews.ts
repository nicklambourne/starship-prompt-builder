import { parseConfig } from "@/lib/config/toml";
import { getModule, moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { renderPrompt, type RenderedPrompt } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { modulePreviewScenario } from "@/lib/scenarios/modulePreview";
import type { ModuleReference } from "./modules";

/** Render one reference example through the same engine as the live builder. */
export function renderModuleReferencePreview(
  reference: ModuleReference,
): RenderedPrompt | null {
  if (!getModule(reference.moduleName)) return null;

  const parsed = parseConfig(reference.example);
  if (!parsed.ok) {
    throw new Error(`Invalid module reference example: ${reference.slug}`);
  }

  const config = {
    ...parsed.config,
    format: reference.format,
    add_newline: false,
  };
  const modules = moduleDefinitionsForConfig(config);
  return renderPrompt({
    config,
    scenario: modulePreviewScenario(reference.moduleName, modules),
    modules,
    defaultOrder: PROMPT_ORDER,
  });
}
