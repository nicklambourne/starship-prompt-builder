/** User-facing instructions shared by the CLI and terminal installation page. */
const AGENT_GUIDE_VERSION = 1;

export const AGENT_GUIDE = `Starship Prompt Builder — Agent guide v${AGENT_GUIDE_VERSION}

Use the CLI non-interactively when helping someone develop a Starship prompt. Do not launch the edit TUI. In a source checkout, substitute node packages/cli/dist/index.js for starship-builder in the commands below.

1. Find the active config: STARSHIP_CONFIG when set, otherwise ~/.config/starship.toml. Check whether it exists. If not, say so and start from a named preset (see starship-builder presets; then validate and preview with --preset <preset-id>); do not treat a missing file as the user's current prompt.
2. Before editing, show the config source and current simulated preview. For an existing file, run:
   starship-builder validate <config-path> --json
   starship-builder preview <config-path> --scenario dirty-repo --width 100 --no-color
   Label the scenario and width. This preview uses simulated data and never runs custom-module commands; do not call it the live shell prompt.
3. Edit a separate candidate TOML file, keeping the original untouched and preserving its comments where practical. Validate and preview the candidate with the same commands, scenario, and width. Also check simple and any scenario relevant to the user's request. Validation exits 2 for invalid config (or warnings under --strict), and 1 for file, parse, or usage errors.
4. Show the user before/after previews, a config diff, and any diagnostics. Explain what changed and what remains simulated. A share link contains the config; only produce or disclose one within the user's requested scope.
5. If asked to apply the candidate, re-read the destination and refuse to overwrite it if it changed since inspection. Back up the original before writing. If asked only for a proposal, leave the live config unchanged.

The current CLI has no non-interactive apply command. Do not claim that the interactive save safeguards also protect direct file edits. Use starship-builder --help for command details.
`;

export const AGENT_STARTER_PROMPT = `Help me improve my Starship prompt using Starship Prompt Builder's CLI. First run starship-builder agent-guide (or node packages/cli/dist/index.js agent-guide if working from a source checkout). Show me my current config source, validation results, and a simulated preview with the scenario and width labelled before editing. Work on a separate candidate TOML file, validate it, then show me before/after previews and the config diff. Do not launch the interactive TUI or run custom-module commands to preview. Only change my live config if I ask you to apply the candidate, and protect it against overwrites and make a backup.`;
