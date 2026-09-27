import { describe, expect, it } from "vitest";
import { parseConfig, serialiseConfig } from "@/lib/config/toml";

const CORPUS = [
  "# comment before a scalar\nadd_newline = false\n",
  "[directory]\ntruncation_length = 2 # trailing note\n",
  "[palettes.\"my.theme\"]\naccent = '#aabbcc'\n",
  "[custom.project]\ncommand = '''\necho multi\nline\n'''\n",
  "[[battery.display]]\nthreshold = 30\nstyle = 'red'\n",
  "# CRLF\r\nadd_newline = false\r\n",
  "[future_module]\nfuture_option = 'kept'\n",
];

describe("source-preservation spike corpus", () => {
  it.each(CORPUS)("preserves semantics while demonstrating regeneration changes source bytes", (source) => {
    const parsed = parseConfig(source);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const generated = serialiseConfig(parsed.config, { header: false });
    const roundTrip = parseConfig(generated);
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(roundTrip.config).toEqual(parsed.config);
    expect(generated).not.toBe(source);
  });
});
