/**
 * Produces the thumbnail shown beside a preset before it is selected.
 *
 * This deliberately goes through the same engine as the main preview. Presets
 * with a demonstration environment use it; the rest use the builder's usual
 * dirty-repository scenario so conditional modules have something to show.
 */

import { loadPreset, type Preset } from "./presets";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { renderPrompt, type RenderedPrompt } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { DEFAULT_SCENARIO_ID, getScenario } from "@/lib/scenarios";

/** Fits the picker at phone width while leaving enough room for right prompts. */
export const PRESET_PREVIEW_WIDTH = 62;

export function renderPresetPreview(preset: Preset): RenderedPrompt | null {
  const config = loadPreset(preset.id);
  if (!config) return null;

  const scenario = {
    ...(preset.environment ?? getScenario(DEFAULT_SCENARIO_ID)),
    terminalWidth: PRESET_PREVIEW_WIDTH,
  };

  return renderPrompt({
    config,
    scenario,
    modules: moduleDefinitionsForConfig(config),
    defaultOrder: PROMPT_ORDER,
  });
}
