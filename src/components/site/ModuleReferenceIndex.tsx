"use client";

import { useState } from "react";

import { ContentCard } from "./ContentShell";

export interface ModuleReferenceListItem {
  slug: string;
  moduleName: string;
  title: string;
  description: string;
  group: string;
  searchTerms?: string[];
}

const ALL_GROUPS = "All categories";

export function ModuleReferenceIndex({
  references,
  groups,
}: {
  references: readonly ModuleReferenceListItem[];
  groups: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>(ALL_GROUPS);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = references.filter((reference) => {
    if (group !== ALL_GROUPS && reference.group !== group) return false;
    if (!normalizedQuery) return true;
    return [
      reference.moduleName,
      reference.title,
      reference.description,
      reference.group,
      ...(reference.searchTerms ?? []),
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
  const resultLabel =
    visible.length === references.length
      ? `${references.length} references`
      : `${visible.length} of ${references.length} references`;

  return (
    <div className="flex flex-col gap-8">
      <div
        role="search"
        className="grid gap-4 rounded-xl border border-white/10 bg-neutral-900/40 p-4 sm:grid-cols-[minmax(0,1fr)_15rem]"
      >
        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-200">
          Filter references
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or purpose..."
            className="min-h-10 w-full rounded border border-white/20 bg-neutral-950 px-3 py-2 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-accent-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-200">
          Category
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="min-h-10 w-full rounded border border-white/20 bg-neutral-950 px-3 py-2 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
          >
            <option>{ALL_GROUPS}</option>
            {groups.map((candidate) => (
              <option key={candidate}>{candidate}</option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-neutral-400">
        {resultLabel}
      </p>

      <div role="region" aria-label="Reference results" className="flex flex-col gap-10">
        {groups.map((candidate) => {
          const references = visible.filter((module) => module.group === candidate);
          return references.length > 0 ? (
            <section key={candidate}>
              <h2 className="text-lg font-semibold text-neutral-100">{candidate}</h2>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {references.map((reference) => (
                  <ContentCard
                    key={reference.slug}
                    href={`/modules/${reference.slug}`}
                    title={reference.title}
                  >
                    {reference.description}
                  </ContentCard>
                ))}
              </ul>
            </section>
          ) : null;
        })}
        {visible.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-neutral-900/40 p-5 text-sm text-neutral-400">
            No references match that filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
