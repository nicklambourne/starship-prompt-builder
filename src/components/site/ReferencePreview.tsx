import { Terminal } from "@/components/terminal/Terminal";
import type { RenderedPrompt } from "@/lib/engine/prompt";
import { TERMINAL_FONTS } from "@/lib/fonts";
import { TERMINAL_THEMES } from "@/lib/terminalThemes";

export function ReferencePreview({
  rendered,
  description,
}: {
  rendered: RenderedPrompt;
  description: string;
}) {
  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="reference-preview-heading"
    >
      <div>
        <h2
          id="reference-preview-heading"
          className="text-xl font-semibold text-neutral-100"
        >
          Preview
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          {description}
        </p>
      </div>
      <Terminal
        lines={rendered.lines}
        right={rendered.right}
        terminalWidth={72}
        leadingNewline={false}
        theme={TERMINAL_THEMES[0]}
        fontStack={TERMINAL_FONTS[0].stack}
        fontSize={14}
        command=""
        className="shadow-none"
      />
    </section>
  );
}
