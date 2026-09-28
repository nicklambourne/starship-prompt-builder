/**
 * The "what is this" preamble that opens the page.
 *
 * Keep the first actions and privacy summary visible; disclose the longer
 * explanation so it does not dominate the first mobile viewport.
 *
 * Accent text uses `accent-300`/`accent-200` rather than `accent-400`: only the tints
 * the light theme darkens in `globals.css` stay legible once the neutral ramp
 * is reversed.
 */
import Link from "next/link";

const LINK = "text-accent-300 underline underline-offset-2 hover:text-accent-200";

export function Explainer({ onImport, onPresets }: { onImport(): void; onPresets(): void }) {
  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900/40 p-4" aria-label="Get started">
      <p className="text-sm text-neutral-300">Build a Starship prompt with a local, simulated preview. Your config stays in your browser.</p>
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        <button type="button" onClick={onPresets} className={LINK}>Choose a preset</button>
        <button type="button" onClick={onImport} className={LINK}>Paste a config</button>
        <Link href="/terminal" className={LINK}>CLI and agent workflow</Link>
      </div>
    <details
      data-section="explainer"
      className="mt-3"
    >
      <summary className="cursor-pointer text-sm font-semibold text-neutral-100 marker:text-neutral-500">
        What is this?
      </summary>

      <div className="mt-2 flex flex-col gap-2 text-sm text-neutral-400">
        <p>
          <a
            href="https://starship.rs"
            className={LINK}
            rel="noreferrer noopener"
            target="_blank"
          >
            Starship
          </a>{" "}
          is a fast, cross-shell prompt configured by a single{" "}
          <code className="text-neutral-300">starship.toml</code> — around a
          hundred modules, each with its own format strings and style strings.
        </p>

        <p>
          Tuning that file normally means editing it, reloading your shell, and
          looking at the result. This closes the loop: you edit visually, the
          prompt re-renders instantly against a simulated shell environment, and
          you export a{" "}
          <code className="text-neutral-300">starship.toml</code> that
          models it. Actual output depends on your shell, tools and font. The editing happens entirely in your browser: your
          config is never uploaded, and the site itself carries no tracking
          code — visits are counted at the edge, without cookies.
        </p>

        <p>
          New to the configuration language? Start with the{" "}
          <Link href="/guides" className={LINK}>
            guides
          </Link>
          , or look up examples and key options in the{" "}
          <Link href="/modules" className={LINK}>
            module reference
          </Link>
          .
        </p>

        <p className="text-neutral-500">
          An unaffiliated community tool, not endorsed by the Starship project —
          which lives at{" "}
          <a
            href="https://github.com/starship/starship"
            className={LINK}
            rel="noreferrer noopener"
            target="_blank"
          >
            github.com/starship/starship
          </a>
          .
        </p>
      </div>
    </details>
    </section>
  );
}
