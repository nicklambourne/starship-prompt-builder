/**
 * Site footer: attribution, the licences page, and the disclaimer.
 *
 * The licences link goes through `next/link` so any base
 * path is applied by the router rather than hard-coded here.
 */

import Link from "next/link";

const LINK = "text-accent-300 underline underline-offset-2 hover:text-accent-200";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-4 py-4 text-xs text-neutral-500">
      <p>
        Built with ♥ by{" "}
        <a
          href="https://github.com/nicklambourne"
          className={LINK}
          rel="noreferrer noopener"
          target="_blank"
        >
          nicklambourne
        </a>
        .{" · "}
        <Link href="/guides" className={LINK}>
          Guides
        </Link>
        {" · "}
        <Link href="/modules" className={LINK}>
          Module reference
        </Link>
        {" · "}
        <Link href="/licences" className={LINK}>
          Licences
        </Link>
      </p>
      <p>
        Starship Prompt Builder is MIT licensed and unaffiliated with the Starship
        project.
      </p>
    </footer>
  );
}
