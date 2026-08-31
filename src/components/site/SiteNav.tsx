import Link from "next/link";

const ITEMS = [
  { href: "/", label: "Builder" },
  { href: "/guides", label: "Guides" },
  { href: "/modules", label: "Module reference" },
] as const;

export function SiteNav({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Primary" className={className}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-neutral-300 underline-offset-4 transition hover:text-accent-200 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
