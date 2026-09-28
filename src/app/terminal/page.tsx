import Link from "next/link";
import { SiteFooter } from "@/components/builder/SiteFooter";
import { ReferenceHeader } from "@/components/site/ReferenceHeader";

export const metadata = {
  title: "Terminal and AI workflow",
  description: "Use the Starship Prompt Builder CLI with an AI assistant to inspect, compare, and review starship.toml before applying changes.",
};

const CODE = "overflow-x-auto rounded-lg border border-white/10 bg-neutral-950 p-4 font-mono text-sm text-neutral-100";
const LINK = "text-accent-300 underline underline-offset-2 hover:text-accent-200";

export default function TerminalPage() {
  return (
    <>
      <ReferenceHeader />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-neutral-200">
        <nav><Link href="/" className={LINK}>← Back to builder</Link></nav>
        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-neutral-100">Build your prompt in the terminal, with or without AI</h1>
          <p>Use the interactive editor or ask your AI assistant to inspect, compare, and review a candidate before you approve a change to <code>starship.toml</code>. Previewing uses simulated data and never runs custom module commands.</p>
        </header>

        <section className="space-y-3 rounded-xl border border-accent-400/40 bg-accent-500/5 p-5">
          <h2 className="text-xl font-semibold text-neutral-100">Continue a design with an AI assistant</h2>
          <p>Start in the <Link href="/" className={LINK}>visual builder</Link> and choose <strong>Continue with AI</strong> beside the preview. Add your goal, inspect the TOML and simulated environment, then copy the instructions into your assistant. The review link carries the same visual context; the copied message includes the actual TOML.</p>
          <p>For an installed file, the assistant can inspect the disk state, compare several simulated shell situations, and propose exact TOML changes. The write step waits for your approval.</p>
          <pre className={CODE} tabIndex={0} aria-label="Agent workflow commands">{`starship-builder agent-guide
starship-builder capabilities
starship-builder state ~/.config/starship.toml --json
starship-builder compare ~/.config/starship.toml --from candidate.toml --json --html review.html
starship-builder apply ~/.config/starship.toml --from candidate.toml --json
starship-builder apply ~/.config/starship.toml --from candidate.toml --yes --review-hash REVIEW_HASH --expect-hash BEFORE_HASH --json`}</pre>
          <p><Link href="/guides/ai-assisted-prompt-design" className={LINK}>See the full walkthrough and a sample request</Link>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">Install the CLI</h2>
          <p>Install the packaged v0.2.0 release with Node.js 22 or newer:</p>
          <pre className={CODE} tabIndex={0} aria-label="Packaged installation commands">{`npm install -g https://github.com/nicklambourne/starship-prompt-builder/releases/download/cli-v0.2.0/starship-prompt-builder-cli-0.2.0.tgz
starship-builder --version`}</pre>
          <p>The CLI package is not yet published to npm. To build from source instead, use the repository build:</p>
          <pre className={CODE} tabIndex={0} aria-label="Installation commands">{`git clone https://github.com/nicklambourne/starship-prompt-builder.git\ncd starship-prompt-builder\ncorepack enable\npnpm install --frozen-lockfile\npnpm build:cli\nnode packages/cli/dist/index.js --help`}</pre>
          <p>Requires Node.js 22 or newer and a UTF-8 terminal at least 60 columns wide. CI checks Linux, macOS, and Windows on Node.js 22 and 24; patched Nerd Fonts are optional for icon-heavy presets.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">Interactive first run</h2>
          <pre className={CODE} tabIndex={0} aria-label="First-run commands">{`starship-builder edit ~/.config/starship.toml\nstarship-builder preview ~/.config/starship.toml --scenario cloud --no-color\nstarship-builder validate ~/.config/starship.toml --json`}</pre>
          <p>If the default config does not exist, interactive mode starts from a preset. Explicit files for preview, validation, and export must exist; <code>state</code> can inspect a missing path as a first-run starting point. Use <code>?</code> for keys or <code>:</code> for searchable actions. Press <code>Ctrl+S</code> to review the exact regenerated file before saving. A changed disk file cannot be silently overwritten.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">Preview and share</h2>
          <p>Environment inputs are simulated. Select a built-in scenario with <code>2</code>, then <code>p</code>, or edit files, tool versions, Git, cloud, battery, and custom output directly. Scenario JSON and portable workspace files are separate from <code>starship.toml</code>.</p>
          <pre className={CODE} tabIndex={0} aria-label="Pipeline and sharing commands">{`cat starship.toml | starship-builder validate - --json\nstarship-builder share starship.toml\nstarship-builder completions zsh`}</pre>
          <p>CLI share links contain configuration only. The builder’s AI review link also carries its simulated environment and appearance. Recovery drafts are stored privately outside the config and never replace it automatically.</p>
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
