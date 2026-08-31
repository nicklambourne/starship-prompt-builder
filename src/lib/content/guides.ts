interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  code?: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  summary: string;
  sections: GuideSection[];
  related: string[];
}

export const GUIDES: readonly Guide[] = [
  {
    slug: "starship-config-generator",
    title: "Starship config generator",
    description: "Build a starship.toml visually, preview it against a simulated shell, and export a portable Starship prompt configuration.",
    summary: "Use the builder as a visual Starship config generator: start with a working prompt, change one layer at a time, then download the exact TOML.",
    sections: [
      {
        heading: "Start from a prompt that already works",
        paragraphs: [
          "Choose a prompt preset if you want a strong visual starting point. The live terminal is the result of the current format, module settings, palette, and simulated environment—not a decorative mockup.",
          "Prompt format controls order and grouping. Module rows control their own options. Palette names let the same colour follow a theme without repeating literal hex values.",
        ],
        bullets: [
          "Change the simulated environment to make language, cloud, Git, and status modules appear.",
          "Use each style button to see whether that row inherits or overrides its parent.",
          "Use undo and redo freely; every builder edit stays in the browser.",
        ],
      },
      {
        heading: "Preview the situations your prompt must survive",
        paragraphs: [
          "A prompt that looks right in one clean directory can still fail in a dirty repository, over SSH, as root, or after an error. Change those inputs and check the same configuration in each state.",
          "If a module is absent, the builder explains the condition that is not met. That is more useful than forcing every module into one unrealistic preview.",
        ],
      },
      {
        heading: "Export the source of truth",
        paragraphs: [
          "Download starship.toml from the preview or output card. Settings equal to Starship defaults are left out of the minimal export.",
          "Put the file at ~/.config/starship.toml, initialise Starship from your shell profile, and open a new shell. You can paste it back into the builder later.",
        ],
        code: "mkdir -p ~/.config\nmv ~/Downloads/starship.toml ~/.config/starship.toml\nexec $SHELL",
      },
    ],
    related: ["import-existing-config", "format-strings", "style-strings"],
  },
  {
    slug: "import-existing-config",
    title: "Import an existing starship.toml",
    description: "Paste an existing starship.toml into the visual builder, preserve unfamiliar settings, preview changes, and export it again.",
    summary: "Start from your current file. Paste the TOML, inspect the parsed prompt, and keep editing visually without uploading the config.",
    sections: [
      {
        heading: "Paste the whole file",
        paragraphs: [
          "Open the starship.toml card and paste your existing configuration. Valid TOML is applied as one undoable change.",
          "Root format values become structured rows when they can be represented safely. Named custom and env_var tables appear as their own instances.",
        ],
        code: "format = \"$directory$git_branch$git_status$character\"\n\n[directory]\nstyle = \"bold cyan\"",
      },
      {
        heading: "Unknown settings are preserved",
        paragraphs: [
          "Starship evolves faster than any visual editor. The parser keeps keys it does not recognise instead of deleting them, so they remain in generated TOML and private share links.",
          "If a format cannot become rows without loss, the builder retains the original string and lets you edit it directly.",
        ],
      },
      {
        heading: "Review before replacing your live config",
        paragraphs: [
          "Compare the output with your current file, especially custom commands and shell-specific behaviour. The preview never executes custom commands.",
          "Share links put compressed config in the URL fragment. It is not sent to this static site, but anyone with the link can read it, so remove secrets first.",
        ],
      },
    ],
    related: ["starship-config-generator", "custom-modules", "format-strings"],
  },
  {
    slug: "format-strings",
    title: "Starship format strings",
    description: "Understand Starship format variables, styled groups, conditional groups, escaping, and how the visual editor maps them to TOML.",
    summary: "Format strings are Starship's layout language: they decide what appears, in what order, when it disappears, and which style reaches it.",
    sections: [
      {
        heading: "Variables insert values",
        paragraphs: [
          "A dollar-prefixed variable inserts a value. At the root, $directory invokes a module. Inside a module, $version or $branch inserts that module's data.",
          "Braces disambiguate names. Use ${custom.project} for a named module and ${version}beta when beta must not become part of the variable name.",
        ],
        code: "$directory$git_branch$git_status\n$symbol($version )\n${custom.project}",
      },
      {
        heading: "Groups add style or conditions",
        paragraphs: [
          "Square brackets collect content and the following parentheses provide a style: [text](bold blue). A plain parenthesised group renders only when a variable inside has a value.",
          "Groups can nest. The visual editor shows them as rows; exported TOML remains ordinary Starship format syntax.",
        ],
        code: "[$symbol$version](bold cyan)\n(via $remote_name/$remote_branch )\n[($user@$hostname )](bold yellow)",
      },
      {
        heading: "Inheritance follows the nearest painted group",
        paragraphs: [
          "A module style only reaches content that still asks for $style. An explicit inner group overrides it. Removing $style can make a valid module style have no visible effect.",
          "The Inherit/Override control expresses that relationship without asking you to rewrite the string.",
        ],
      },
      {
        heading: "Escape syntax characters when they are literal",
        paragraphs: ["Backslash-escape brackets, parentheses, dollar signs, and backslashes when they should print instead of parse. TOML escaping adds a second layer."],
        code: "\\[$directory\\] \\$literal",
      },
    ],
    related: ["style-strings", "custom-modules", "starship-config-generator"],
  },
  {
    slug: "style-strings",
    title: "Starship style strings",
    description: "Use foreground colours, backgrounds, palette names, and text modifiers in Starship style strings, including inheritance inside formats.",
    summary: "A Starship style is a space-separated set of colours and modifiers. The builder exposes controls while preserving the same compact output.",
    sections: [
      {
        heading: "Choose foreground and background colours",
        paragraphs: [
          "A bare colour sets the foreground; prefix a background with bg:. Colours may be ANSI names, indexed colours, hex values, or active-palette names.",
          "Palette colours make a prompt easy to retheme: change one entry and every style referring to it follows.",
        ],
        code: "bold cyan\nfg:#cdd6f4 bg:#313244\nfg:text bg:surface",
      },
      {
        heading: "Add text modifiers",
        paragraphs: [
          "Modifiers include bold, dimmed, italic, underline, blink, reversed, hidden, and strikethrough. Terminal support varies.",
          "The builder's buttons edit the same style string, and the preview resolves ANSI names against the selected terminal theme.",
        ],
        code: "bold italic bright-blue\nunderline fg:yellow bg:black",
      },
      {
        heading: "Know which style wins",
        paragraphs: [
          "Module style is the normal default. A styled group inside the format overrides it, while an item set to Inherit uses the nearest surrounding style.",
          "A root group can style several modules together, but an explicitly styled inner module group may still win.",
        ],
      },
    ],
    related: ["format-strings", "starship-config-generator"],
  },
  {
    slug: "custom-modules",
    title: "Custom Starship modules",
    description: "Create named Starship custom modules with command, when, detection, format, and style settings, then place them in the prompt.",
    summary: "Custom modules run a command you define and render its output, representing local project state that no built-in module knows.",
    sections: [
      {
        heading: "Create a named instance",
        paragraphs: [
          "A custom module is a named table such as [custom.project]. Its prompt variable is ${custom.project}; the aggregate $custom renders unnamed references.",
          "Use a short, stable name. The builder updates both the table and every format reference when you rename it.",
        ],
        code: "format = \"${custom.project}$directory$character\"\n\n[custom.project]\ncommand = \"basename $PWD\"\nwhen = true\nformat = \"[$symbol$output]($style) \"\nstyle = \"bold yellow\"",
      },
      {
        heading: "Control when the command runs",
        paragraphs: [
          "Use when for a shell condition, or detect_files, detect_folders, and detect_extensions for project detection.",
          "Keep commands quick and deterministic because they execute whenever Starship draws the prompt. Prefer a built-in module when it exposes the same information.",
        ],
      },
      {
        heading: "Preview safely",
        paragraphs: [
          "The browser does not execute the command. Supply a representative output value in Simulated environment to preview formatting and empty output.",
          "Treat imported custom commands as executable code before installing a config. The builder preserves them but cannot decide whether they are trustworthy.",
        ],
      },
    ],
    related: ["format-strings", "import-existing-config"],
  },
] as const;

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
