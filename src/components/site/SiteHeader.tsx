import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/Logo";
import { SiteNav } from "./SiteNav";

const IDENTITY_CLASS =
  "flex items-center gap-2 text-lg font-semibold tracking-tight";

function Identity() {
  return (
    <>
      {/*
        Bigger than the line it sits on. The margin is exactly -7px so the
        mark's layout height stays 30px while it draws at 44px. Its viewBox
        carries glow bleed, so the visible ink is 40px of the 44.
      */}
      <Logo size={44} className="-my-[7px]" />
      Starship Prompt Builder
    </>
  );
}

export function SiteHeader({
  homeLink = false,
  children,
}: {
  homeLink?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur">
      {homeLink ? (
        <Link
          href="/"
          className={`${IDENTITY_CLASS} text-neutral-100 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400`}
        >
          <Identity />
        </Link>
      ) : (
        <h1 className={IDENTITY_CLASS}>
          <Identity />
        </h1>
      )}
      <SiteNav className="order-3 w-full sm:order-none sm:w-auto" />
      {children}
    </header>
  );
}
