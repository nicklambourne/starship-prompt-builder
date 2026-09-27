import Link from "next/link";
import { SiteFooter } from "@/components/builder/SiteFooter";

export const metadata = {
  title: "Terminal app — Starship Prompt Builder",
  description: "Install and use the terminal prompt editor, preview scenarios, validation, and safe save workflow.",
};

const CODE = "overflow-x-auto rounded-lg border border-white/10 bg-neutral-950 p-4 font-mono text-sm text-neutral-100";
const LINK = "text-accent-300 underline underline-offset-2 hover:text-accent-200";

export default function TerminalPage() {
  return (
    <>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-neutral-200">
        <nav><Link href="/" className={LINK}>← Back to builder</Link></nav>
        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-neutral-100">Build your prompt in the terminal</h1>
          <p>The terminal app edits <code>starship.toml</code> with a live simulated preview. It never runs custom module commands while previewing.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">Install from source</h2>
          <p>The CLI package is not yet published to npm. Until its release, use the repository build:</p>
          <pre className={CODE} tabIndex={0} aria-label="Installation commands">{`git clone https://github.com/nicklambourne/starship-prompt-builder.git\ncd starship-prompt-builder\ncorepack enable\npnpm install --frozen-lockfile\npnpm build:cli\nnode packages/cli/dist/index.js --help`}</pre>
          <p>Requires Node.js 22 or newer and a UTF-8 terminal at least 60 columns wide. CI checks Linux, macOS, and Windows on Node.js 22 and 24; patched Nerd Fonts are optional for icon-heavy presets.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">First run</h2>
          <pre className={CODE} tabIndex={0} aria-label="First-run commands">{`node packages/cli/dist/index.js edit ~/.config/starship.toml\nnode packages/cli/dist/index.js preview ~/.config/starship.toml --scenario cloud --no-color\nnode packages/cli/dist/index.js validate ~/.config/starship.toml --json`}</pre>
          <p>If the default config does not exist, interactive mode starts from a preset. Explicit files for preview, validation, and export must exist. Use <code>?</code> for keys or <code>:</code> for searchable actions. Press <code>Ctrl+S</code> to review the exact regenerated file before saving. A changed disk file cannot be silently overwritten.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">Preview and share</h2>
          <p>Environment inputs are simulated. Select a built-in scenario with <code>2</code>, then <code>p</code>, or edit files, tool versions, Git, cloud, battery, and custom output directly. Scenario JSON and portable workspace files are separate from <code>starship.toml</code>.</p>
          <pre className={CODE} tabIndex={0} aria-label="Pipeline and sharing commands">{`cat starship.toml | node packages/cli/dist/index.js validate - --json\nnode packages/cli/dist/index.js share starship.toml\nnode packages/cli/dist/index.js completions zsh`}</pre>
          <p>Share links contain configuration only. Export a workspace from the TOML pane when the simulated environment must travel with it. Recovery drafts are stored privately outside the config and never replace it automatically.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">Troubleshooting</h2>
          <p>If the preview looks different from your shell, compare the selected scenario, terminal width, and font. <code>--no-color</code> removes ANSI color from headless previews. The save review marks regenerated TOML; comments and source formatting may not survive an edited save. An unchanged save keeps the original bytes.</p>
          <p>For a terminal that intercepts shortcuts, use <code>:</code> to search for Undo, Redo, Save, module settings, and other actions. If an editor has changed the file in the meantime, reload it or use Save As.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
