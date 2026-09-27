import { parseColorString } from "@/lib/engine/styleString";
import type { StarshipConfig } from "@/lib/engine/prompt";

type PaletteTables = Record<string, Record<string, string>>;

export function paletteTables(config: StarshipConfig): PaletteTables {
  return config.palettes && typeof config.palettes === "object" && !Array.isArray(config.palettes)
    ? config.palettes as PaletteTables : {};
}

export function createPalette(config: StarshipConfig, name: string, copyFrom?: string): StarshipConfig {
  const tables = paletteTables(config);
  if (!name.trim() || Object.hasOwn(tables, name)) return config;
  return { ...config, palettes: { ...tables, [name]: copyFrom ? { ...tables[copyFrom] } : {} }, palette: name };
}

export function renamePalette(config: StarshipConfig, oldName: string, newName: string): StarshipConfig {
  const tables = paletteTables(config);
  if (!Object.hasOwn(tables, oldName) || !newName.trim() || Object.hasOwn(tables, newName)) return config;
  const next = Object.fromEntries(Object.entries(tables).map(([name, colors]) => [name === oldName ? newName : name, colors]));
  return { ...config, palettes: next, ...(config.palette === oldName ? { palette: newName } : {}) };
}

export function deletePalette(config: StarshipConfig, name: string): StarshipConfig {
  const tables = paletteTables(config);
  if (!Object.hasOwn(tables, name) || config.palette === name) return config;
  const next = { ...tables };
  delete next[name];
  return { ...config, palettes: next };
}

export function setPaletteColor(config: StarshipConfig, palette: string, name: string, color: string): StarshipConfig {
  const tables = paletteTables(config);
  if (!Object.hasOwn(tables, palette) || !name.trim() || !parseColorString(color.toLowerCase())) return config;
  return { ...config, palettes: { ...tables, [palette]: { ...tables[palette], [name]: color } } };
}

export function deletePaletteColor(config: StarshipConfig, palette: string, name: string): StarshipConfig {
  const tables = paletteTables(config);
  if (!Object.hasOwn(tables[palette] ?? {}, name)) return config;
  const colors = { ...tables[palette] };
  delete colors[name];
  return { ...config, palettes: { ...tables, [palette]: colors } };
}
