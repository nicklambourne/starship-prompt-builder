import type { Metadata } from "next";
import Link from "next/link";

import {
  CodeBlock,
  CONTENT_LINK,
  ContentShell,
} from "@/components/site/ContentShell";
import { ReferencePreview } from "@/components/site/ReferencePreview";
import glyphData from "@/../data/glyphs.generated.json";
import { encodeShare } from "@/lib/config/share";
import { serialiseConfig } from "@/lib/config/toml";
import {
  UNICODE_CATEGORY,
  UNICODE_SYMBOLS,
} from "@/lib/config/unicodeSymbols";
import { renderPrompt, type StarshipConfig } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { TERMINAL_FONTS } from "@/lib/fonts";
import { getScenario } from "@/lib/scenarios";

const DESCRIPTION =
  "Add literal text, spacing, separators, labels, Unicode characters, and Nerd Font symbols anywhere in a Starship prompt.";

export const metadata: Metadata = {
  title: "Text component",
  description: DESCRIPTION,
  alternates: { canonical: "/modules/text/" },
  openGraph: {
    title: "Text component for Starship prompts",
    description: DESCRIPTION,
    url: "/modules/text/",
    type: "article",
  },
};

const TEXT_CONFIG: StarshipConfig = {
  format:
    "[](fg:bright-blue)[ Text · \\$literal](bold black bg:bright-blue)[](fg:bright-blue)",
  add_newline: false,
};

const TEXT_EXAMPLE = serialiseConfig(TEXT_CONFIG, {
  defaults: {},
  header: false,
}).trimEnd();

const TEXT_PREVIEW = renderPrompt({
  config: TEXT_CONFIG,
  scenario: getScenario("simple"),
  modules: [],
  defaultOrder: PROMPT_ORDER,
});

const BUILDER_HREF = "/#" + encodeShare(TEXT_CONFIG);
const BUNDLED_FONTS = TERMINAL_FONTS.filter((font) => font.source);

export default function TextComponentPage() {
  return (
    <ContentShell
      title="Text component"
      description={DESCRIPTION}
      path="/modules/text/"
      parent="Module reference"
      parentHref="/modules"
    >
      <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-10">
          <section>
            <h2 className="text-xl font-semibold text-neutral-100">
              What it does
            </h2>
            <p className="mt-3 text-sm leading-7 text-neutral-400">
              Text prints literal characters exactly where you place them in
              the prompt format. Use it for spaces, separators, labels, or
              symbols between modules and groups. It is a builder component,
              not a Starship module, so it does not create a{" "}
              <code className="text-neutral-200">[text]</code> table in the
              exported TOML.
            </p>
          </section>

          <ReferencePreview
            rendered={TEXT_PREVIEW}
            description="A literal Text item containing Powerline separators, ordinary Unicode, an escaped dollar sign, and an explicit style."
          />

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-neutral-100">
              Starting configuration
            </h2>
            <CodeBlock>{TEXT_EXAMPLE}</CodeBlock>
            <a
              href={BUILDER_HREF}
              aria-label="Open the Text example in the builder"
              className="inline-flex w-fit rounded border border-accent-400 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
            >
              Open in the builder
            </a>
            <p className="text-xs leading-5 text-neutral-500">
              The configuration is compressed into the URL fragment and stays
              in your browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-100">
              Add and style text
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-7 text-neutral-400">
              <li>
                In Prompt format, choose{" "}
                <span className="font-medium text-neutral-200">+ Add text</span>
                , then expand the new Text row.
              </li>
              <li>
                Type or paste any character. The lightning-bolt button opens
                the searchable symbol picker and inserts the chosen symbol at
                the caret.
              </li>
              <li>
                Use the style button to inherit the surrounding style or
                override it with foreground, background, and font modifiers.
                Drag the row to position it between modules or inside a group.
              </li>
            </ol>
            <p className="mt-4 text-sm leading-7 text-neutral-400">
              The builder automatically escapes characters that Starship uses
              as format syntax:{" "}
              <code className="text-neutral-200">$ [ ] ( ) \</code>. When
              writing a format by hand, prefix a literal one with a backslash;
              inside a TOML basic string, that backslash must itself be
              escaped.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-100">
              Available symbols
            </h2>
            <p className="mt-3 text-sm leading-7 text-neutral-400">
              The picker starts with {UNICODE_SYMBOLS.length} curated Unicode
              characters: chevrons, arrows, box drawing, blocks, shapes,
              status marks, dots, and separators. These are ordinary Unicode
              and normally work with a stock monospace terminal font.
            </p>
            <p className="mt-3 text-sm leading-7 text-neutral-400">
              It also contains{" "}
              {glyphData.glyphs.length.toLocaleString("en-US")} glyphs from{" "}
              <a
                href="https://www.nerdfonts.com/cheat-sheet"
                target="_blank"
                rel="noreferrer noopener"
                className={CONTENT_LINK}
              >
                Nerd Fonts {glyphData.nerdFontsVersion}
              </a>
              . Search looks across every set; when the search is empty, the
              picker exposes these category tabs:
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Included symbol sets">
              {[UNICODE_CATEGORY, ...glyphData.categories].map((category) => (
                <li
                  key={category}
                  className="rounded-full border border-white/10 bg-neutral-900/40 px-3 py-1 text-xs text-neutral-300"
                >
                  {category}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-7 text-neutral-400">
              The catalogue keeps codepoints present in at least one bundled
              preview font; {glyphData.omitted} upstream named glyphs are
              excluded because none of those fonts contains them. Emoji are
              not offered because terminal width and colour rendering varies,
              but you can still paste one into a Text item.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-100">
              Use the same font in your terminal
            </h2>
            <p className="mt-3 text-sm leading-7 text-neutral-400">
              Nerd Font symbols use private-use codepoints. The web fonts make
              them visible in this builder, but they do not install a font in
              your terminal. Install a Nerd Font-patched font and select it in
              your terminal settings before relying on those symbols.
              Ordinary symbols from the Unicode category do not require a
              patched font.
            </p>
            <p className="mt-3 text-sm leading-7 text-neutral-400">
              The preview bundles Regular and Bold Mono faces for these{" "}
              {BUNDLED_FONTS.length} families:
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-neutral-400 sm:grid-cols-2">
              {BUNDLED_FONTS.map((font) => (
                <li key={font.id} className="rounded border border-white/10 px-3 py-2">
                  {font.label}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-7 text-neutral-400">
              See the{" "}
              <Link href="/licences" className={CONTENT_LINK}>
                bundled font licences
              </Link>{" "}
              for sources and redistribution details.
            </p>
          </section>
        </div>

        <aside className="flex flex-col gap-5 rounded-xl border border-white/10 bg-neutral-900/40 p-5 lg:sticky lg:top-24">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Starship output</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Literal characters in the root or module format string; no
              configuration table.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Category</h2>
            <p className="mt-2 text-sm text-neutral-400">Prompt components</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Related guides</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <Link href="/guides/format-strings" className={CONTENT_LINK}>
                  Format strings
                </Link>
              </li>
              <li>
                <Link href="/guides/style-strings" className={CONTENT_LINK}>
                  Style strings
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </article>
    </ContentShell>
  );
}
