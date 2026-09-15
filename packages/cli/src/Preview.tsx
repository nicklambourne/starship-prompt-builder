import React from "react";
import { Box, Text } from "ink";

import type { Color, Segment, Style } from "@/lib/engine/types";

const NAMED_COLORS: Record<string, string> = {
  black: "black",
  red: "red",
  green: "green",
  yellow: "yellow",
  blue: "blue",
  purple: "magenta",
  cyan: "cyan",
  white: "white",
  "bright-black": "blackBright",
  "bright-red": "redBright",
  "bright-green": "greenBright",
  "bright-yellow": "yellowBright",
  "bright-blue": "blueBright",
  "bright-purple": "magentaBright",
  "bright-cyan": "cyanBright",
  "bright-white": "whiteBright",
};

function colorValue(color: Color | undefined): string | undefined {
  if (!color) return undefined;
  switch (color.kind) {
    case "named":
      return NAMED_COLORS[color.name];
    case "fixed":
      return `ansi256(${color.index})`;
    case "rgb":
      return `rgb(${color.r}, ${color.g}, ${color.b})`;
    case "prev":
      return undefined;
  }
}

function resolvePrevious(style: Style, previous: Style | undefined): Style {
  const fg = style.fg?.kind === "prev"
    ? style.fg.source === "fg" ? previous?.fg : previous?.bg
    : style.fg;
  const bg = style.bg?.kind === "prev"
    ? style.bg.source === "fg" ? previous?.fg : previous?.bg
    : style.bg;
  return { fg, bg, modifiers: style.modifiers };
}

function resolveSegmentStyles(segments: Segment[]) {
  return segments.reduce<{
    previous: Style | undefined;
    values: Array<{ index: number; value: string; style: Style | undefined }>;
  }>((state, segment, index) => {
    if (segment.kind !== "text" || segment.value.length === 0) return state;
    const style = segment.style ? resolvePrevious(segment.style, state.previous) : undefined;
    return {
      previous: style,
      values: [...state.values, { index, value: segment.value, style }],
    };
  }, { previous: undefined, values: [] }).values;
}

function StyledSegments({
  segments,
  color = true,
}: {
  segments: Segment[];
  color?: boolean;
}) {
  const resolved = resolveSegmentStyles(segments);
  return (
    <Text>
      {resolved.map(({ index, value, style }) => {
        if (!color || !style) return <Text key={index}>{value}</Text>;
        return (
          <Text
            key={index}
            color={style.modifiers.has("hidden") ? colorValue(style.bg) ?? "black" : colorValue(style.fg)}
            backgroundColor={colorValue(style.bg)}
            bold={style.modifiers.has("bold")}
            dimColor={style.modifiers.has("dimmed")}
            italic={style.modifiers.has("italic")}
            underline={style.modifiers.has("underline")}
            strikethrough={style.modifiers.has("strikethrough")}
            inverse={style.modifiers.has("inverted")}
          >
            {value}
          </Text>
        );
      })}
    </Text>
  );
}

export function PromptPreview({
  lines,
  right,
  scenarioLabel,
  width,
  color,
  warnings,
}: {
  lines: Segment[][];
  right: Segment[];
  scenarioLabel: string;
  width: number;
  color: boolean;
  warnings: string[];
}) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">PREVIEW</Text>
        <Text dimColor>{scenarioLabel} · {width} cols</Text>
      </Box>
      {lines.map((line, index) => (
        <Box key={index} justifyContent="space-between" width="100%">
          <StyledSegments segments={line} color={color} />
          {index === lines.length - 1 && right.length > 0
            ? <StyledSegments segments={right} color={color} />
            : null}
        </Box>
      ))}
      {warnings.slice(0, 1).map((warning) => (
        <Text key={warning} color="yellow" wrap="truncate-end">! {warning}</Text>
      ))}
    </Box>
  );
}
