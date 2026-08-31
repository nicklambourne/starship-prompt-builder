/**
 * The "what is this" preamble that opens the page.
 *
 * Collapsible because it is written for a first-time visitor and is pure noise
 * on every visit after that; open by default because an explanation hidden
 * behind a click explains nothing to the person who needed it.
 *
 * Accent text uses `accent-300`/`accent-200` rather than `accent-400`: only the tints
 * the light theme darkens in `globals.css` stay legible once the neutral ramp
 * is reversed.
 */
import Link from "next/link";

const LINK = "text-accent-300 underline underline-offset-2 hover:text-accent-200";

export function Explainer() {
  return (
    <details
      open
      data-section="explainer"
      className="rounded-xl border border-white/10 bg-neutral-900/40 p-4"
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
          you export the exact{" "}
          <code className="text-neutral-300">starship.toml</code> that
          reproduces it. The editing happens entirely in your browser: your
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
  );
}
