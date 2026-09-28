import { performance } from "node:perf_hooks";
import { renderPrompt } from "@/lib/engine/prompt";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { getPreset, DEFAULT_PRESET_ID } from "@/lib/config/presets";
import { parseConfig } from "@/lib/config/toml";
import { listScenarios } from "@/lib/scenarios";

const parsed = parseConfig(getPreset(DEFAULT_PRESET_ID)!.toml);
if (!parsed.ok) throw new Error(parsed.error);
const config = parsed.config;
const modules = moduleDefinitionsForConfig(config);
const scenarios = listScenarios();
const draw = (scenario: typeof scenarios[number]) => renderPrompt({ config, modules, scenario, defaultOrder: PROMPT_ORDER });
function measure(compare: boolean) {
  for (let i = 0; i < 20; i++) draw(scenarios[0]);
  const samples = Array.from({ length: 15 }, () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      draw(scenarios[0]);
      if (compare) scenarios.forEach(draw);
    }
    return (performance.now() - start) / 100;
  }).sort((a, b) => a - b);
  return { medianMs: samples[7], p95Ms: samples[14], samples };
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, fixture: DEFAULT_PRESET_ID,
  note: "Rendering workload per config change; excludes Ink input, layout and terminal I/O. Comparison stays available on demand.",
  previousEagerComparison: measure(true), activePreviewOnly: measure(false) }, null, 2));
