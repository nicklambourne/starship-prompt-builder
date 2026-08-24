/**
 * Licences.
 *
 * The site redistributes twelve patched Nerd Fonts, and every one of their
 * licences requires that the licence travel with the font. This page is where
 * that requirement is met: for each bundled family it names the font, its
 * licence, the upstream project, and links both the canonical upstream licence
 * and the verbatim copy served from `public/fonts/licences/`.
 *
 * The font list is derived from `TERMINAL_FONTS` rather than restated, and the
 * vendored themes from `PRESETS`, so the pickers and this page cannot disagree
 * about what is shipped. The reasoning
 * behind each grant (and the two families excluded on licence grounds) lives in
 * `THIRD_PARTY.md` and `public/fonts/README.md`.
 *
 * Links to the bundled texts use `next/link` so any base
 * path is applied by the router; `target="_blank"` keeps the router from
 * intercepting the click, since these are static files and not routes.
 */

import Link from "next/link";

import { SiteFooter } from "@/components/builder/SiteFooter";
import { PRESETS, type Preset } from "@/lib/config/presets";
import { TERMINAL_FONTS } from "@/lib/fonts";

export const metadata = { title: "Licences — Starship Prompt Builder" };

interface FontNotice {
  /** File name under `public/fonts/licences/`. */
  file: string;
  /** Upstream project, as `owner/repo`. */
  project: string;
  projectUrl: string;
  copyright: string;
}

const NOTICES: Record<string, FontNotice> = {
  hack: {
    file: "Hack-LICENSE.md",
    project: "source-foundry/Hack",
    projectUrl: "https://github.com/source-foundry/Hack",
    copyright: "© 2018 Source Foundry Authors; © 2003 Bitstream, Inc.",
  },
  "jetbrains-mono": {
    file: "JetBrainsMono-OFL.txt",
    project: "JetBrains/JetBrainsMono",
    projectUrl: "https://github.com/JetBrains/JetBrainsMono",
    copyright: "© 2020 The JetBrains Mono Project Authors",
  },
  "fira-code": {
    file: "FiraCode-OFL.txt",
    project: "tonsky/FiraCode",
    projectUrl: "https://github.com/tonsky/FiraCode",
    copyright: "© 2014 The Fira Code Project Authors",
  },
  "caskaydia-cove": {
    file: "CascadiaCode-OFL.txt",
    project: "microsoft/cascadia-code",
    projectUrl: "https://github.com/microsoft/cascadia-code",
    copyright: "© 2019–present Microsoft Corporation",
  },
  "sauce-code-pro": {
    file: "SourceCodePro-OFL.txt",
    project: "adobe-fonts/source-code-pro",
    projectUrl: "https://github.com/adobe-fonts/source-code-pro",
    copyright: "© 2010–2020 Adobe",
  },
  "iosevka-term": {
    file: "Iosevka-OFL.md",
    project: "be5invis/Iosevka",
    projectUrl: "https://github.com/be5invis/Iosevka",
    copyright: "© 2015–2026 Renzhi Li (Belleve Invis)",
  },
  "blex-mono": {
    file: "IBMPlexMono-OFL.txt",
    project: "IBM/plex",
    projectUrl: "https://github.com/IBM/plex",
    copyright: "© 2017 IBM Corp.",
  },
  "roboto-mono": {
    file: "RobotoMono-LICENSE.txt",
    project: "googlefonts/RobotoMono",
    projectUrl: "https://github.com/googlefonts/RobotoMono",
    copyright: "© 2015 The Roboto Mono Project Authors",
  },
  "dejavu-sans-mono": {
    file: "DejaVu-LICENSE.txt",
    project: "dejavu-fonts/dejavu-fonts",
    projectUrl: "https://github.com/dejavu-fonts/dejavu-fonts",
    copyright:
      "© 2003 Bitstream, Inc.; DejaVu changes in the public domain; Arev additions © Tavmjong Bah",
  },
  inconsolata: {
    file: "Inconsolata-OFL.txt",
    project: "googlefonts/Inconsolata",
    projectUrl: "https://github.com/googlefonts/Inconsolata",
    copyright: "© 2006 The Inconsolata Project Authors",
  },
  "space-mono": {
    file: "SpaceMono-OFL.txt",
    project: "googlefonts/spacemono",
    projectUrl: "https://github.com/googlefonts/spacemono",
    copyright: "© 2016 The Space Mono Project Authors",
  },
  "noto-sans-mono": {
    file: "NotoSansMono-OFL.txt",
    project: "notofonts/latin-greek-cyrillic",
    projectUrl: "https://github.com/notofonts/latin-greek-cyrillic",
    copyright: "© 2022 The Noto Project Authors",
  },
};

/** Bundled fonts are the ones with a `source` archive; the rest is the OS stack. */
const BUNDLED = TERMINAL_FONTS.filter((font) => font.source !== "");

/**
 * A bundled font missing from `NOTICES` would ship without its attribution,
 * which is exactly what this page exists to prevent — so fail the build rather
 * than render an incomplete notice.
 */
const UNDOCUMENTED = BUNDLED.filter((font) => !NOTICES[font.id]);
if (UNDOCUMENTED.length > 0) {
  throw new Error(
    `Bundled fonts with no licence notice: ${UNDOCUMENTED.map((f) => f.id).join(", ")}`,
  );
}

const LINK = "text-accent-300 underline underline-offset-2 hover:text-accent-200";
const CARD = "rounded-xl border border-white/10 bg-neutral-900/40 p-4";
const H2 = "text-base font-semibold text-neutral-100";

/**
 * The presets starship does not publish, grouped by the project that does.
 * Read from the preset data rather than restated, so the picker and this page
 * cannot disagree about whose work is being redistributed — the same reason
 * the font list is derived from `TERMINAL_FONTS`.
 */
const COMMUNITY_PRESETS: Array<{ source: Preset["source"]; presets: Preset[] }> =
  PRESETS.filter((preset) => preset.source.project !== "starship").reduce<
    Array<{ source: Preset["source"]; presets: Preset[] }>
  >((groups, preset) => {
    const existing = groups.find((group) => group.source.project === preset.source.project);
    if (existing) existing.presets.push(preset);
    else groups.push({ source: preset.source, presets: [preset] });
    return groups;
  }, []);

function External({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className={LINK}
      rel="noreferrer noopener"
      target="_blank"
    >
      {children}
    </a>
  );
}

export default function LicencesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2">
          <Link href="/" className={`${LINK} text-sm`}>
            ← Back to the builder
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
            Licences
          </h1>
          <p className="text-sm text-neutral-400">
            Starship Prompt Builder is{" "}
            <External href="https://github.com/nicklambourne/starship-prompt-builder/blob/main/LICENSE">
              MIT licensed
            </External>{" "}
            and is not affiliated with or endorsed by any of the projects named
            below. It redistributes the following third-party work.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className={H2}>Bundled fonts</h2>
          <p className="text-sm text-neutral-400">
            The terminal preview self-hosts {BUNDLED.length}{" "}
            <External href="https://www.nerdfonts.com">Nerd Fonts</External>{" "}
            patched monospace families as woff2, so prompt glyphs render for
            visitors with no patched font installed. All were taken from the
            Nerd Fonts v3.5.0 release; only the Regular and Bold weights of each
            family&rsquo;s Mono variant are bundled. Each licence below permits
            redistribution and web embedding.
          </p>

          <ul className="flex flex-col gap-3">
            {BUNDLED.map((font) => {
              const notice = NOTICES[font.id];
              return (
                <li key={font.id} className={CARD}>
                  <h3 className="text-sm font-semibold text-neutral-100">
                    {font.label}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-400">
                    {font.licence} — {notice.copyright}
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">
                    From{" "}
                    <External href={notice.projectUrl}>
                      {notice.project}
                    </External>
                    . <External href={font.licenceUrl}>Upstream licence</External>{" "}
                    ·{" "}
                    <Link
                      href={`/fonts/licences/${notice.file}`}
                      className={LINK}
                      prefetch={false}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Bundled licence text
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>

          <p className="text-sm text-neutral-500">
            The font picker&rsquo;s <em>System monospace</em> option bundles
            nothing: it falls back to whatever monospace font the operating
            system provides.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={H2}>Nerd Fonts patch layer</h2>
          <p className="text-sm text-neutral-400">
            A patched build is a derivative work, so each font above carries its
            upstream licence <em>plus</em> the{" "}
            <External href="https://github.com/ryanoasis/nerd-fonts">
              Nerd Fonts
            </External>{" "}
            project&rsquo;s own terms: MIT for the{" "}
            <code className="text-neutral-300">font-patcher</code> tooling and
            SIL OFL 1.1 for the patched output and glyph sources, © 2014 Ryan L
            McIntyre.{" "}
            <External href="https://github.com/ryanoasis/nerd-fonts/blob/master/LICENSE">
              Upstream licence
            </External>{" "}
            ·{" "}
            <Link
              href="/fonts/licences/NerdFonts-LICENSE.txt"
              className={LINK}
              prefetch={false}
              target="_blank"
              rel="noreferrer noopener"
            >
              Bundled licence text
            </Link>
          </p>
          <p className="text-sm text-neutral-400">
            Three families are renamed by Nerd Fonts for licence compliance.
            Cascadia Code, Source Code Pro and IBM Plex Mono are released under
            the OFL with the Reserved Font Names{" "}
            <code className="text-neutral-300">Cascadia Code</code>,{" "}
            <code className="text-neutral-300">Source</code> and{" "}
            <code className="text-neutral-300">Plex</code>, and the OFL forbids a
            modified build from carrying a reserved name — so the patched
            versions ship as CaskaydiaCove, SauceCodePro and BlexMono. DejaVuSansM
            and NotoSansM are abbreviations rather than renames: OpenType family
            names are length-limited, so <em>Mono</em> is shortened to{" "}
            <code className="text-neutral-300">M</code>.
          </p>
          <p className="text-sm text-neutral-400">
            <strong className="font-semibold text-neutral-300">
              Roboto Mono.
            </strong>{" "}
            Google relicensed the Roboto family to SIL OFL 1.1 in 2024, but the
            Nerd Fonts v3.5.0 build predates that: the patched binary declares
            Apache 2.0 in its own name table, and the release archive ships the
            Apache text. That is the grant governing the file bundled here, so
            that is what is recorded above; the current upstream OFL is an
            additional permission, not a replacement. Both permit redistribution
            and web embedding.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={H2}>Presets and palettes</h2>
          <p className="text-sm text-neutral-400">
            Five of the presets in the picker are themes their own projects
            publish for starship, vendored verbatim, and the palettes they carry
            are offered separately in the palette editor. The colours and the
            names are their authors&rsquo; work.
          </p>
          <ul className="flex flex-col gap-3">
            {COMMUNITY_PRESETS.map(({ source, presets }) => (
              <li key={source.project} className="flex flex-col gap-1">
                <span className="text-sm text-neutral-200">
                  <External href={source.url}>{source.project}</External>{" "}
                  <span className="text-neutral-500">{source.copyright}</span>
                </span>
                <span className="text-sm text-neutral-400">
                  {presets.map((preset) => preset.label).join(", ")} —{" "}
                  <External href={source.licenceUrl}>{`${source.licence} licensed`}</External>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={H2}>Starship</h2>
          <p className="text-sm text-neutral-400">
            Starship&rsquo;s configuration JSON Schema, its twelve official
            preset TOMLs and its configuration reference are vendored into this site
            to drive the module list, the preset picker and the explanations of
            what each module and each format variable does. Starship is © the
            Starship contributors and{" "}
            <External href="https://github.com/starship/starship/blob/master/LICENSE">
              ISC licensed
            </External>
            . See{" "}
            <External href="https://starship.rs">starship.rs</External> for the
            prompt itself — this site is an unaffiliated community tool.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
