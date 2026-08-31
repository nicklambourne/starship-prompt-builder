import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { SiteNav } from "./SiteNav";

export function ReferenceHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-100 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
        >
          <Logo size={36} />
          Starship Prompt Builder
        </Link>
        <SiteNav className="ml-auto" />
      </div>
    </header>
  );
}
