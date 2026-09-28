import React, { useState } from "react";
import { useInput } from "ink";
import { Text, safeTerminalText } from "./safeText";

/** Keep editable source intact; sanitize every literal before Ink applies styles. */
export function TextInput({ defaultValue = "", suggestions = [], onChange, onSubmit }: {
  defaultValue?: string;
  suggestions?: string[];
  onChange?(value: string): void;
  onSubmit?(value: string): void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [cursor, setCursor] = useState(defaultValue.length);
  const graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value));
  const previous = graphemes.reduce((offset, part) => part.index < cursor ? part.index : offset, 0);
  const next = graphemes.find((part) => part.index > cursor)?.index ?? value.length;
  const suggestion = value ? suggestions.find((item) => item.startsWith(value))?.slice(value.length) ?? "" : "";
  const update = (text: string, offset: number) => {
    setValue(text);
    setCursor(offset);
    onChange?.(text);
  };
  useInput((input, key) => {
    if (key.escape || key.upArrow || key.downArrow || key.tab || key.ctrl || key.meta) return;
    if (key.return) {
      if (suggestion) update(value + suggestion, value.length + suggestion.length);
      onSubmit?.(value + suggestion);
    } else if (key.leftArrow) setCursor(previous);
    else if (key.rightArrow) setCursor(next);
    else if (key.backspace || key.delete) {
      if (cursor > 0) update(value.slice(0, previous) + value.slice(cursor), previous);
    } else if (input) update(value.slice(0, cursor) + input + value.slice(cursor), cursor + input.length);
  });
  const atEnd = cursor === value.length;
  const firstSuggestion = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(suggestion))[0]?.segment ?? "";
  return <Text>
    {safeTerminalText(value.slice(0, cursor))}
    <Text inverse>{safeTerminalText(atEnd ? firstSuggestion || " " : value.slice(cursor, next))}</Text>
    {safeTerminalText(value.slice(next))}
    <Text dimColor>{safeTerminalText(atEnd ? suggestion.slice(firstSuggestion.length) : suggestion)}</Text>
  </Text>;
}
