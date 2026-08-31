import type { Metadata } from "next";

import "./globals.css";

/**
 * Site-wide defaults for search engines and link unfurlers. Individual guide
 * and module pages supply their own titles, descriptions, and canonical URLs.
 *
 * `metadataBase` is what makes the rest work: without it Next emits relative
 * URLs for the preview image and the canonical link, and neither a crawler nor
 * a chat client can resolve those. It is the deployed origin plus the Pages
 * base path.
 */
const SITE = "https://starship.ndl.au";

const DESCRIPTION =
  "Configure the Starship prompt visually. Edit every module, style and " +
  "format string against a live preview of a simulated shell, then export " +
  "the starship.toml that reproduces it. Runs entirely in your browser.";

const TITLE = "Starship Prompt Builder — a visual editor for starship.toml";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: "%s — Starship Prompt Builder",
  },
  description: DESCRIPTION,
  referrer: "strict-origin-when-cross-origin",
  applicationName: "Starship Prompt Builder",
  authors: [{ name: "Nicholas Lambourne", url: "https://ndl.au" }],
  creator: "Nicholas Lambourne",
  keywords: [
    "starship prompt",
    "starship.toml",
    "shell prompt",
    "prompt configurator",
    "terminal prompt generator",
    "zsh prompt",
    "bash prompt",
    "fish prompt",
    "nerd fonts",
    "powerline",
    "dotfiles",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Starship Prompt Builder",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "A simulated terminal prompt above the editor that produced it.",
      },
    ],
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "developer tools",
};

/**
 * What the page is, in the vocabulary a search engine reads. A web
 * application rather than a generic page: this is a tool, and saying so is
 * what lets a result show that it is free and needs nothing installed.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Starship Prompt Builder",
  url: SITE,
  description: DESCRIPTION,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any (runs in a web browser)",
  browserRequirements: "Requires JavaScript.",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
  license:
    "https://github.com/nicklambourne/starship-prompt-builder/blob/main/LICENSE",
  author: { "@type": "Person", name: "Nicholas Lambourne", url: "https://ndl.au" },
  about: {
    "@type": "SoftwareApplication",
    name: "Starship",
    url: "https://starship.rs",
    applicationCategory: "DeveloperApplication",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before first paint so the interface never flashes dark at
          someone whose system is set to light. React only takes over the
          attribute when the toggle is used.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}catch(e){}",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
