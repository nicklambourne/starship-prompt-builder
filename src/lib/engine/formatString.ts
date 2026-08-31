/**
 * Format-string parser.
 *
 * A hand-written recursive-descent port of starship's pest grammar
 * (`src/formatter/spec.pest`). The grammar is small but the escaping and
 * nesting rules are exacting, so this file mirrors the original rule-for-rule:
 *
 *   expression = SOI ~ value* ~ EOI
 *   value      = text | variable | textgroup | conditional
 *   variable   = "$" ~ (variable_name | "{" variable_scoped_name "}")
 *   textgroup  = "[" format "]" "(" style ")"
 *   conditional = "(" format ")"
 *   escaped_char = "[" | "]" | "(" | ")" | "\" | "$"
 */

export type FormatElement =
  | { type: "text"; value: string }
  | { type: "variable"; name: string }
  | { type: "textGroup"; format: FormatElement[]; style: StyleElement[] }
  | { type: "conditional"; format: FormatElement[] };

/** Style strings may themselves interpolate variables, e.g. `[x]($style)`. */
export type StyleElement =
  | { type: "text"; value: string }
  | { type: "variable"; name: string };

class FormatParseError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
    this.name = "FormatParseError";
  }
}

const ESCAPABLE = new Set(["[", "]", "(", ")", "\\", "$"]);

function isVariableStart(ch: string): boolean {
  return /[a-zA-Z_]/.test(ch);
}

function isVariableChar(ch: string): boolean {
  return /[a-zA-Z0-9_]/.test(ch);
}

class Parser {
  private pos = 0;

  constructor(private readonly input: string) {}

  private peek(): string | undefined {
    return this.input[this.pos];
  }

  private eof(): boolean {
    return this.pos >= this.input.length;
  }

  /**
   * Parses a sequence of values until EOF or one of `stopChars` is reached.
   * The caller consumes the stop character.
   */
  parseFormat(stopChars: Set<string>): FormatElement[] {
    const elements: FormatElement[] = [];
    let text = "";

    const flushText = () => {
      if (text.length > 0) {
        elements.push({ type: "text", value: text });
        text = "";
      }
    };

    while (!this.eof()) {
      const ch = this.input[this.pos];

      if (stopChars.has(ch)) break;

      if (ch === "\\") {
        const next = this.input[this.pos + 1];
        if (next !== undefined && ESCAPABLE.has(next)) {
          text += next;
          this.pos += 2;
          continue;
        }
        // A backslash that doesn't escape a functional char is literal text.
        text += ch;
        this.pos += 1;
        continue;
      }

      if (ch === "$") {
        const variable = this.tryParseVariable();
        if (variable) {
          flushText();
          elements.push(variable);
          continue;
        }
        // A `$` not starting a valid variable is literal text.
        text += ch;
        this.pos += 1;
        continue;
      }

      if (ch === "[") {
        const group = this.tryParseTextGroup();
        if (group) {
          flushText();
          elements.push(group);
          continue;
        }
        throw new FormatParseError(
          "Unmatched '[' — a text group must be written as [format](style)",
          this.pos,
        );
      }

      if (ch === "(") {
        flushText();
        this.pos += 1; // consume '('
        const inner = this.parseFormat(new Set([")"]));
        if (this.peek() !== ")") {
          throw new FormatParseError("Unmatched '(' in conditional", this.pos);
        }
        this.pos += 1; // consume ')'
        elements.push({ type: "conditional", format: inner });
        continue;
      }

      if (ch === "]" || ch === ")") {
        throw new FormatParseError(`Unexpected '${ch}' — escape it as \\${ch}`, this.pos);
      }

      text += ch;
      this.pos += 1;
    }

    flushText();
    return elements;
  }

  /** `$name` or `${scoped.name}`. Returns undefined if this isn't a variable. */
  private tryParseVariable(): FormatElement | undefined {
    const start = this.pos;
    this.pos += 1; // consume '$'

    if (this.peek() === "{") {
      this.pos += 1;
      let name = "";
      while (!this.eof()) {
        const ch = this.input[this.pos];
        // scoped_char = !(escaped_char | "{" | "}") ~ ANY
        if (ch === "}") break;
        if (ch === "{" || ESCAPABLE.has(ch)) {
          this.pos = start;
          return undefined;
        }
        name += ch;
        this.pos += 1;
      }
      if (this.peek() !== "}" || name.length === 0) {
        this.pos = start;
        return undefined;
      }
      this.pos += 1; // consume '}'
      return { type: "variable", name };
    }

    const first = this.peek();
    if (first === undefined || !isVariableStart(first)) {
      this.pos = start;
      return undefined;
    }
    let name = first;
    this.pos += 1;
    while (!this.eof() && isVariableChar(this.input[this.pos])) {
      name += this.input[this.pos];
      this.pos += 1;
    }
    return { type: "variable", name };
  }

  /** `[format](style)`. Returns undefined if the trailing `(style)` is absent. */
  private tryParseTextGroup(): FormatElement | undefined {
    const start = this.pos;
    this.pos += 1; // consume '['
    const format = this.parseFormat(new Set(["]"]));
    if (this.peek() !== "]") {
      this.pos = start;
      return undefined;
    }
    this.pos += 1; // consume ']'
    if (this.peek() !== "(") {
      this.pos = start;
      return undefined;
    }
    this.pos += 1; // consume '('
    const style = this.parseStyle();
    if (this.peek() !== ")") {
      this.pos = start;
      return undefined;
    }
    this.pos += 1; // consume ')'
    return { type: "textGroup", format, style };
  }

  /** style = (variable | string)* — no nesting, terminated by ')'. */
  private parseStyle(): StyleElement[] {
    const elements: StyleElement[] = [];
    let text = "";

    const flushText = () => {
      if (text.length > 0) {
        elements.push({ type: "text", value: text });
        text = "";
      }
    };

    while (!this.eof()) {
      const ch = this.input[this.pos];
      if (ch === ")") break;

      if (ch === "$") {
        const variable = this.tryParseVariable();
        if (variable && variable.type === "variable") {
          flushText();
          elements.push({ type: "variable", name: variable.name });
          continue;
        }
      }

      text += ch;
      this.pos += 1;
    }

    flushText();
    return elements;
  }

  position(): number {
    return this.pos;
  }
}

/** Parses a format string, throwing `FormatParseError` on malformed input. */
export function parseFormatString(input: string): FormatElement[] {
  const parser = new Parser(input);
  const elements = parser.parseFormat(new Set());
  if (parser.position() < input.length) {
    throw new FormatParseError(
      `Unexpected '${input[parser.position()]}'`,
      parser.position(),
    );
  }
  return elements;
}

/** Non-throwing variant, for live editing where partial input is expected. */
export function tryParseFormatString(
  input: string,
): { ok: true; elements: FormatElement[] } | { ok: false; error: string; index: number } {
  try {
    return { ok: true, elements: parseFormatString(input) };
  } catch (err) {
    if (err instanceof FormatParseError) {
      return { ok: false, error: err.message, index: err.index };
    }
    throw err;
  }
}

/**
 * Variable names referenced in the *format* positions of a tree.
 *
 * Mirrors starship's `VariableHolder::get_variables`: it recurses into text
 * groups' formats and into conditionals, but deliberately NOT into a text
 * group's style. Style variables must not make a conditional visible — i.e.
 * `([x]($style))` hinges on `x`, never on `$style`.
 */
export function collectVariables(elements: FormatElement[]): string[] {
  const found: string[] = [];
  const walk = (els: FormatElement[]) => {
    for (const el of els) {
      switch (el.type) {
        case "variable":
          found.push(el.name);
          break;
        case "textGroup":
          walk(el.format);
          break;
        case "conditional":
          walk(el.format);
          break;
        case "text":
          break;
      }
    }
  };
  walk(elements);
  return found;
}

/** Variable names referenced in style positions, e.g. the `$style` in `[x]($style)`. */
export function collectStyleVariables(elements: FormatElement[]): string[] {
  const found: string[] = [];
  const walk = (els: FormatElement[]) => {
    for (const el of els) {
      if (el.type === "textGroup") {
        for (const s of el.style) if (s.type === "variable") found.push(s.name);
        walk(el.format);
      } else if (el.type === "conditional") {
        walk(el.format);
      }
    }
  };
  walk(elements);
  return found;
}

/** Escapes text so it survives a round trip through the parser. */
function escapeFormatText(value: string): string {
  return value.replace(/[[\]()\\$]/g, (ch) => `\\${ch}`);
}

/**
 * Prints a format tree back to a format string.
 *
 * The inverse of `parseFormatString`, used by the visual format builder to
 * serialise edits. It is not guaranteed to reproduce the original source
 * byte-for-byte — redundant escapes are normalised — but re-parsing its output
 * always yields an equivalent tree.
 */
export function printFormat(elements: FormatElement[]): string {
  return elements
    .map((el) => {
      switch (el.type) {
        case "text":
          return escapeFormatText(el.value);
        case "variable":
          // Braces are required whenever the name carries characters that would
          // otherwise terminate a bare `$name`, e.g. `${env_var.HOME}`.
          return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(el.name)
            ? `$${el.name}`
            : `\${${el.name}}`;
        case "textGroup": {
          const style = el.style
            .map((s) => (s.type === "text" ? s.value : `$${s.name}`))
            .join("");
          return `[${printFormat(el.format)}](${style})`;
        }
        case "conditional":
          return `(${printFormat(el.format)})`;
      }
    })
    .join("");
}
