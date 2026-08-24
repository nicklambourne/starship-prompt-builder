# Bundled terminal fonts

The terminal preview offers a set of self-hosted [Nerd Fonts](https://www.nerdfonts.com)
patched builds so that prompt glyphs (powerline separators, devicons, git
symbols) render for every visitor, whether or not they have a patched font
installed locally.

Every font here is redistributable and web-embeddable under its licence. All
files were taken from the **Nerd Fonts v3.5.0** release (published 2026-08-02),
via `https://github.com/ryanoasis/nerd-fonts/releases/latest/download/<Name>.zip`.

## What the picker offers

Nerd Fonts ships `glyphnames.json` alongside the fonts, and it can name glyphs
the release's own fonts do not contain: 3.5.0 names 105 devicons
(U+E8F0–U+E958, `nats` through `zustand`) that none of these files can draw.
`pnpm build:glyphs` filters the catalogue against the `cmap` of every face
here, so the symbol picker offers a glyph only if something can draw it, and
`tests/unit/glyph-coverage.test.ts` fails if that stops being true.

## What is bundled

Only the **Regular** and **Bold** weights of the **Mono** (`NerdFontMono`)
variant of each family. The Mono variant forces the added icon glyphs into a
single cell, which is how a real terminal renders them — the default and Propo
variants use wider icons and would misalign the simulated columns. Italics are
not bundled; nothing in the preview renders italic text.

| Font | CSS family | Upstream project | Licence | Licence file | Regular | Bold |
| --- | --- | --- | --- | --- | ---: | ---: |
| Hack Nerd Font (default) | `Hack Nerd Font Mono` | [source-foundry/Hack](https://github.com/source-foundry/Hack) | MIT (+ Bitstream Vera) | [`licences/Hack-LICENSE.md`](licences/Hack-LICENSE.md) | 1.17 MiB | 1.17 MiB |
| JetBrainsMono Nerd Font | `JetBrainsMono Nerd Font Mono` | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) | SIL OFL 1.1 | [`licences/JetBrainsMono-OFL.txt`](licences/JetBrainsMono-OFL.txt) | 1.01 MiB | 1.02 MiB |
| FiraCode Nerd Font | `FiraCode Nerd Font Mono` | [tonsky/FiraCode](https://github.com/tonsky/FiraCode) | SIL OFL 1.1 | [`licences/FiraCode-OFL.txt`](licences/FiraCode-OFL.txt) | 1.16 MiB | 1.16 MiB |
| CaskaydiaCove Nerd Font | `CaskaydiaCove Nerd Font Mono` | [microsoft/cascadia-code](https://github.com/microsoft/cascadia-code) | SIL OFL 1.1 | [`licences/CascadiaCode-OFL.txt`](licences/CascadiaCode-OFL.txt) | 1.18 MiB | 1.18 MiB |
| SauceCodePro Nerd Font | `SauceCodePro Nerd Font Mono` | [adobe-fonts/source-code-pro](https://github.com/adobe-fonts/source-code-pro) | SIL OFL 1.1 | [`licences/SourceCodePro-OFL.txt`](licences/SourceCodePro-OFL.txt) | 1.00 MiB | 1.00 MiB |
| IosevkaTerm Nerd Font | `IosevkaTerm Nerd Font Mono` | [be5invis/Iosevka](https://github.com/be5invis/Iosevka) | SIL OFL 1.1 | [`licences/Iosevka-OFL.md`](licences/Iosevka-OFL.md) | 2.46 MiB | 2.48 MiB |
| BlexMono Nerd Font | `BlexMono Nerd Font Mono` | [IBM/plex](https://github.com/IBM/plex) | SIL OFL 1.1 | [`licences/IBMPlexMono-OFL.txt`](licences/IBMPlexMono-OFL.txt) | 0.97 MiB | 0.97 MiB |
| RobotoMono Nerd Font | `RobotoMono Nerd Font Mono` | [googlefonts/RobotoMono](https://github.com/googlefonts/RobotoMono) | Apache 2.0 | [`licences/RobotoMono-LICENSE.txt`](licences/RobotoMono-LICENSE.txt) | 1.11 MiB | 1.11 MiB |
| DejaVuSansM Nerd Font | `DejaVuSansM Nerd Font Mono` | [dejavu-fonts](https://github.com/dejavu-fonts/dejavu-fonts) | Bitstream Vera (+ Arev) | [`licences/DejaVu-LICENSE.txt`](licences/DejaVu-LICENSE.txt) | 1.21 MiB | 1.20 MiB |
| Inconsolata Nerd Font | `Inconsolata Nerd Font Mono` | [googlefonts/Inconsolata](https://github.com/googlefonts/Inconsolata) | SIL OFL 1.1 | [`licences/Inconsolata-OFL.txt`](licences/Inconsolata-OFL.txt) | 0.95 MiB | 0.95 MiB |
| SpaceMono Nerd Font | `SpaceMono Nerd Font Mono` | [googlefonts/spacemono](https://github.com/googlefonts/spacemono) | SIL OFL 1.1 | [`licences/SpaceMono-OFL.txt`](licences/SpaceMono-OFL.txt) | 0.97 MiB | 0.97 MiB |
| NotoSansM Nerd Font | `NotoSansM Nerd Font Mono` | [notofonts/latin-greek-cyrillic](https://github.com/notofonts/latin-greek-cyrillic) | SIL OFL 1.1 | [`licences/NotoSansMono-OFL.txt`](licences/NotoSansMono-OFL.txt) | 1.07 MiB | 1.07 MiB |

**Total: 28.55 MiB (29,935,264 bytes) across 24 woff2 files.**

The picker also offers a *System monospace (no Nerd Font)* option. It bundles
nothing and falls back to the OS monospace stack, so users can see how their
prompt degrades on an unpatched font.

Hack is the default, and the *first* entry of `TERMINAL_FONTS` in
`src/lib/fonts.ts` is what makes it so — reorder that list to change the
default rather than hard-coding an id anywhere else.

### Names that differ from their upstream project

Three families are renamed by Nerd Fonts for licence compliance. Cascadia Code,
Source Code Pro and IBM Plex Mono are released under the OFL with Reserved Font
Names (`Cascadia Code`, `Source` and `Plex` respectively); OFL §3 forbids a
modified build from carrying a reserved name, so the patched versions ship as
**CaskaydiaCove**, **SauceCodePro** and **BlexMono**. Those are the correct,
licence-compliant names and are kept verbatim here.

Two more are abbreviations rather than renames: OpenType family names are
length-limited, so Nerd Fonts shortens *Mono* to `M` — DejaVu Sans Mono becomes
**DejaVuSansM** and Noto Sans Mono becomes **NotoSansM**.

## Licensing

A patched Nerd Font is a derivative work carrying two licence layers:

1. **The upstream font's licence**, which governs the original outlines. Verbatim
   copies of each are in [`licences/`](licences), taken from the release archives.
2. **The Nerd Fonts project's own licence** for the patcher and the added glyph
   set — MIT for the tooling, SIL OFL 1.1 for the patched font output and glyph
   sources (Copyright © 2014 Ryan L McIntyre). See
   [`licences/NerdFonts-LICENSE.txt`](licences/NerdFonts-LICENSE.txt).

All twelve bundled fonts permit redistribution and embedding, including as
webfonts. The OFL requires that the licence travel with the font and that the
fonts not be sold on their own; both hold here. Hack and DejaVu Sans Mono carry
the Bitstream Vera licence for the outlines they inherit, which likewise permits
redistribution and embedding and only reserves the names "Bitstream" and "Vera"
— neither of which appears in "Hack Nerd Font" or "DejaVuSansM Nerd Font".

**Roboto Mono note.** Google relicensed the Roboto family to SIL OFL 1.1 in
2024, but the Nerd Fonts v3.5.0 build predates that: the patched binary's own
name table says *"Licensed under the Apache License, Version 2.0"* and the
release archive ships the Apache text. The Apache grant is what governs the
file bundled here, so that is what is recorded and shipped; the current
upstream OFL is an additional, not a replacement, permission. Either way
redistribution and web embedding are permitted.

## Deliberately excluded

| Font | Licence | Why it is not bundled |
| --- | --- | --- |
| **UbuntuMono Nerd Font** | Ubuntu Font Licence 1.0 | Two unresolved problems. The UFL states that fonts and derivatives "cannot be released under any other licence", which conflicts with Nerd Fonts publishing its patched output under the OFL; and a *Substantially Changed* derivative "must be renamed to avoid use of the name of the Original Version or similar names entirely", yet the patched build ships as "UbuntuMono Nerd Font". "Ubuntu" is also a Canonical trademark. Excluded as unverifiable. |
| **Meslo Nerd Font** | Apache 2.0 (claimed) | Meslo is Apache-2.0 by André Berg, but it is a customisation of **Apple's Menlo**, and the font's own copyright string credits Apple Inc. (2009) alongside Bitstream. Apple has not licensed Menlo for redistribution, so the Apache grant is made by someone who may not hold the necessary rights. The chain cannot be verified; excluded. |

Both exclusions are on licence grounds and are not up for revisiting on size or
popularity arguments.

IosevkaTerm and DejaVuSansM were previously excluded on size alone; the payload
budget was raised deliberately when the family count grew, so both are now
bundled.

## Size policy

Nerd Font builds carry several thousand icon glyphs, and the preview renders
arbitrary glyphs from user-supplied config — a user may put any Unicode
codepoint in a `format` string. Subsetting to a fixed glyph list would silently
break those configs, so **glyph coverage is never reduced**. The only levers
used are:

- woff2 compression (roughly 2.4 MB TTF → 1.0 MB woff2, ~58% saved);
- Regular + Bold only, Mono variant only;
- limiting the *number* of bundled families.

Twelve families cost 28.55 MiB. Eleven of them sit between 1.90 and 2.41 MiB;
IosevkaTerm is the outlier at 4.94 MiB, because Iosevka ships far broader
Unicode coverage than the rest. If the payload ever needs to come down, drop
whole families — starting with IosevkaTerm — rather than subsetting any of them.

This is a repository and deploy cost, not a page-load cost: `@font-face` faces
are fetched lazily, so a visitor downloads only the weights of the font they
actually select — about 1.2 MiB for the default before any bold text is drawn,
2.34 MiB for both weights, and nothing at all for the system-monospace option.

## Reproducing these files

```sh
curl -LO https://github.com/ryanoasis/nerd-fonts/releases/latest/download/Hack.zip
unzip -j Hack.zip 'HackNerdFontMono-Regular.ttf' \
                  'HackNerdFontMono-Bold.ttf' -d ttf/
nix-shell -p woff2 --run 'woff2_compress ttf/HackNerdFontMono-Regular.ttf'
```

The release zip's licence file (`LICENSE.md`, `LICENSE.txt` or `OFL.txt`,
depending on the family) goes into [`licences/`](licences) alongside it.

The woff2 files are a lossless repackaging of the release TTFs — the conversion
changes the container only, never the outlines, metrics, or name table.

## Where the font files live

The `.woff2` files are in `src/assets/fonts/`, not here. Anything under
`public/` is copied verbatim into the export *and* emitted again as a
content-hashed asset by the bundler, so keeping 29 MB of fonts in `public/`
shipped every byte twice — 83 MB of artefact for 42 MB of content, with
browsers only ever fetching the hashed copies.

The licence texts stay in `public/fonts/licences/` on purpose: those are meant
to be served at a stable, linkable URL.
