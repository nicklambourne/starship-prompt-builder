/** Native fallbacks used by the style-option controls, not a new cascade. */
export interface StyleFallback {
  value: string;
  source: string;
}

export function styleOptionFallback(
  defaults: Record<string, unknown>,
  values: Record<string, unknown>,
  key: string,
): StyleFallback {
  const defaultValue = defaults[key];
  if (typeof defaultValue === "string") {
    return { value: defaultValue, source: `Starship default for ${key}` };
  }
  // Optional directory/status styles fall back to the module's style option.
  const moduleStyle = values.style ?? defaults.style;
  return {
    value: typeof moduleStyle === "string" ? moduleStyle : "",
    source: "Module style",
  };
}

export interface StyleRules {
  labelKey: "threshold" | "context_pattern";
  fallback: StyleFallback;
}

export function styleRulesFor(
  module: string,
  option: string,
  defaults: Record<string, unknown>,
  values: Record<string, unknown>,
): StyleRules | undefined {
  if (module === "battery" && option === "display") {
    const display = defaults.display as { style: string }[];
    return {
      labelKey: "threshold",
      fallback: { value: display[0].style, source: "Starship default for battery display" },
    };
  }
  if (module === "kubernetes" && option === "contexts") {
    const style = values.style ?? defaults.style;
    return {
      labelKey: "context_pattern",
      fallback: { value: typeof style === "string" ? style : "", source: "Module style" },
    };
  }
  return undefined;
}
