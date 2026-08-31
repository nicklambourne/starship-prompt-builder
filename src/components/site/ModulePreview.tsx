import { Terminal } from "@/components/terminal/Terminal";
import type { ModuleReference } from "@/lib/content/modules";
import { renderModuleReferencePreview } from "@/lib/content/modulePreviews";
import { TERMINAL_FONTS } from "@/lib/fonts";
import { TERMINAL_THEMES } from "@/lib/terminalThemes";

export function ModulePreview({ reference }: { reference: ModuleReference }) {
  const rendered = renderModuleReferencePreview(reference);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="module-preview-heading">
      <div>
        <h2
          id="module-preview-heading"
          className="text-xl font-semibold text-neutral-100"
        >
          Preview
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Rendered from the starting configuration in a representative simulated
          environment.
        </p>
      </div>
      <Terminal
        lines={rendered.lines}
        right={rendered.right}
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
