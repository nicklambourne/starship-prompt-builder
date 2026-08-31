export const PROMPT_COMPONENT_GROUP = "Prompt components";

export interface PromptComponentReference {
  slug: string;
  componentName: string;
  title: string;
  description: string;
  group: typeof PROMPT_COMPONENT_GROUP;
  searchTerms: string[];
}

/**
 * Builder-only format pieces that are useful alongside Starship's modules.
 *
 * These are deliberately separate from MODULE_REFERENCES: Text is format
 * syntax, not a Starship module table, so pretending it has module options or
 * a text table would teach users invalid TOML.
 */
export const PROMPT_COMPONENT_REFERENCES: readonly PromptComponentReference[] = [
  {
    slug: "text",
    componentName: "text",
    title: "Text component",
    description: "Add literal text, spacing, separators, labels, Unicode characters, and Nerd Font symbols anywhere in the prompt.",
    group: PROMPT_COMPONENT_GROUP,
    searchTerms: ["literal", "symbol", "glyph", "separator", "label", "spacing"],
  },
];
