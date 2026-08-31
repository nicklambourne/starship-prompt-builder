import { encodeShare } from "@/lib/config/share";
import { parseConfig } from "@/lib/config/toml";

export interface ModuleReference {
  slug: string;
  moduleName: string;
  title: string;
  description: string;
  when: string;
  example: string;
  format: string;
  keyOptions: string[];
  variables: string[];
  adjustments: string[];
  related: string[];
}

export const MODULE_REFERENCES: readonly ModuleReference[] = [
  {
    slug: "directory",
    moduleName: "directory",
    title: "Directory module",
    description: "Show the current working directory with controlled truncation, repository-root treatment, read-only indicators, and style.",
    when: "The directory module is available in every prompt. Its path changes with the shell's current working directory.",
    example: "[directory]\ntruncation_length = 4\ntruncate_to_repo = true\nstyle = \"bold cyan\"",
    format: "$directory",
    keyOptions: ["format", "style", "truncation_length", "truncate_to_repo", "read_only", "home_symbol"],
    variables: ["path", "read_only", "repo_root", "style"],
    adjustments: [
      "Increase truncation_length when important parent folders disappear.",
      "Keep truncate_to_repo enabled when the repository name matters more than its parents.",
      "Use repo_root_style to distinguish the project root without restyling the whole path.",
    ],
    related: ["git-branch", "git-status"],
  },
  {
    slug: "git-branch",
    moduleName: "git_branch",
    title: "Git branch module",
    description: "Show the active Git branch, its remote relationship, and a branch symbol when the current directory is inside a repository.",
    when: "It renders inside a Git repository when Starship can resolve a branch or detached commit name.",
    example: "[git_branch]\nsymbol = \" \"\ntruncation_length = 32\nstyle = \"bold purple\"",
    format: "$git_branch",
    keyOptions: ["format", "symbol", "style", "truncation_length", "truncation_symbol", "only_attached"],
    variables: ["symbol", "branch", "remote_name", "remote_branch"],
    adjustments: [
      "Shorten long branch names with truncation_length and a visible truncation_symbol.",
      "Use only_attached when detached HEAD labels add more noise than value.",
      "Put remote variables in a conditional group so they disappear when no upstream exists.",
    ],
    related: ["git-status", "directory"],
  },
  {
    slug: "git-status",
    moduleName: "git_status",
    title: "Git status module",
    description: "Summarise staged, modified, deleted, renamed, conflicted, untracked, stashed, ahead, and behind Git state.",
    when: "It renders inside a Git repository when at least one configured status value has content.",
    example: "[git_status]\nformat = \"([$all_status$ahead_behind]($style) )\"\nstyle = \"bold yellow\"",
    format: "$git_status",
    keyOptions: ["format", "style", "stashed", "modified", "staged", "untracked", "ahead", "behind", "diverged"],
    variables: ["all_status", "ahead_behind", "stashed", "modified", "staged", "untracked", "conflicted"],
    adjustments: [
      "Keep $all_status and $ahead_behind if you want Starship's compact aggregate output.",
      "Place individual status variables in conditional groups when each needs a different label.",
      "Set ignore_submodules when submodule dirtiness is too expensive or distracting.",
    ],
    related: ["git-branch", "directory"],
  },
  {
    slug: "character",
    moduleName: "character",
    title: "Character module",
    description: "Render the final input character for success, error, and Vim editing modes.",
    when: "It is the cursor-side end of the prompt and always chooses one configured symbol.",
    example: "[character]\nsuccess_symbol = \"[❯](bold green)\"\nerror_symbol = \"[❯](bold red)\"\nvimcmd_symbol = \"[❮](bold green)\"",
    format: "$character",
    keyOptions: ["format", "success_symbol", "error_symbol", "vimcmd_symbol", "vimcmd_visual_symbol"],
    variables: ["symbol"],
    adjustments: [
      "Keep success and error shapes consistent if colour alone should carry status.",
      "Give Vim command modes a reversed shape so mode remains clear without text.",
      "Leave character at the end of the prompt so input begins in the expected place.",
    ],
    related: ["directory"],
  },
  {
    slug: "username",
    moduleName: "username",
    title: "Username module",
    description: "Show the current user and apply separate styles for regular and root sessions.",
    when: "By default it appears for root, SSH, and other non-default user sessions; show_always makes it permanent.",
    example: "[username]\nshow_always = true\nstyle_user = \"bold blue\"\nstyle_root = \"bold red\"\nformat = \"[$user]($style) \"",
    format: "$username",
    keyOptions: ["format", "show_always", "style_user", "style_root", "aliases", "detect_env_vars"],
    variables: ["user", "style"],
    adjustments: [
      "Keep show_always false when the username only matters in unusual sessions.",
      "Use aliases to shorten machine or directory-service account names.",
      "Retain $style in format if style_user and style_root should paint the output.",
    ],
    related: ["hostname"],
  },
  {
    slug: "hostname",
    moduleName: "hostname",
    title: "Hostname module",
    description: "Show the machine hostname, optionally only for SSH sessions, with aliases and domain trimming.",
    when: "It appears over SSH by default. Set ssh_only to false to show it in local shells as well.",
    example: "[hostname]\nssh_only = false\ntrim_at = \".\"\nformat = \"[$ssh_symbol$hostname]($style) \"\nstyle = \"bold green\"",
    format: "$hostname",
    keyOptions: ["format", "ssh_only", "ssh_symbol", "trim_at", "style", "aliases"],
    variables: ["ssh_symbol", "hostname", "style"],
    adjustments: [
      "Keep ssh_only enabled if the hostname is mainly protection against editing the wrong remote.",
      "Use trim_at to remove a repeated corporate or home DNS suffix.",
      "Pair it with username in one optional styled group for compact user@host output.",
    ],
    related: ["username"],
  },
  {
    slug: "nodejs",
    moduleName: "nodejs",
    title: "Node.js module",
    description: "Show the active Node.js version when the current project or files indicate a JavaScript runtime.",
    when: "It appears when Node.js is available and the directory contains configured extensions, files, or folders.",
    example: "[nodejs]\nsymbol = \" \"\nformat = \"via [$symbol($version )]($style)\"\nstyle = \"bold green\"",
    format: "$nodejs",
    keyOptions: ["format", "symbol", "style", "version_format", "detect_extensions", "detect_files", "detect_folders"],
    variables: ["symbol", "version", "engines_version"],
    adjustments: [
      "Tune detection lists if the module appears in non-Node repositories or misses a monorepo.",
      "Use version_format to choose raw, major, minor, and patch version detail.",
      "Keep the version group conditional so an unavailable version leaves no dangling text.",
    ],
    related: ["python"],
  },
  {
    slug: "python",
    moduleName: "python",
    title: "Python module",
    description: "Show the Python version and active virtual environment for detected Python projects.",
    when: "It appears when Python is available and a configured file, extension, folder, or environment variable is detected.",
    example: "[python]\nsymbol = \" \"\nformat = \"via [${symbol}${pyenv_prefix}(${version} )(${virtualenv} )]($style)\"\nstyle = \"bold yellow\"",
    format: "$python",
    keyOptions: ["format", "symbol", "style", "pyenv_version_name", "pyenv_prefix", "python_binary", "detect_extensions", "detect_files"],
    variables: ["symbol", "version", "virtualenv", "pyenv_prefix"],
    adjustments: [
      "Keep virtualenv in a conditional group so parentheses vanish when no environment is active.",
      "Set pyenv_version_name when the selected pyenv label is more useful than the interpreter version.",
      "Adjust python_binary when the expected executable has a project-specific name.",
    ],
    related: ["nodejs"],
  },
  {
    slug: "custom",
    moduleName: "custom",
    title: "Custom module",
    description: "Run a named command and display its output with Starship's detection, format, and style system.",
    when: "A named custom module runs only when its when or detect settings pass, and renders when its command supplies output.",
    example: "[custom.project]\ncommand = \"basename $PWD\"\nwhen = true\nformat = \"[$symbol$output]($style) \"\nsymbol = \"project:\"\nstyle = \"bold yellow\"",
    format: "${custom.project}",
    keyOptions: ["command", "when", "format", "symbol", "style", "shell", "detect_files", "detect_folders", "detect_extensions", "os"],
    variables: ["symbol", "output"],
    adjustments: [
      "Keep command fast because it may execute every time the prompt renders.",
      "Use detect settings to avoid running a project-specific command everywhere.",
      "Audit imported commands before installing a config; they are executable local code.",
    ],
    related: [],
  },
  {
    slug: "aws",
    moduleName: "aws",
    title: "AWS module",
    description: "Show the active AWS profile, region, and temporary-credential duration.",
    when: "It appears when AWS environment variables or configuration identify credentials, a profile, or a region.",
    example: "[aws]\nformat = \"on [$symbol($profile )($region )($duration )]($style)\"\nstyle = \"bold yellow\"",
    format: "$aws",
    keyOptions: ["format", "symbol", "style", "force_display", "region_aliases", "profile_aliases", "expiration_symbol"],
    variables: ["symbol", "profile", "region", "duration"],
    adjustments: [
      "Use profile_aliases to replace long SSO profile names with recognisable labels.",
      "Use region_aliases when compact region names still remain unambiguous.",
      "Keep duration conditional so permanent credentials do not leave empty brackets.",
    ],
    related: ["kubernetes"],
  },
  {
    slug: "kubernetes",
    moduleName: "kubernetes",
    title: "Kubernetes module",
    description: "Show the active Kubernetes context, namespace, user, and cluster with context-specific aliases.",
    when: "It is disabled by default. Once enabled, it renders when a current Kubernetes context is available.",
    example: "[kubernetes]\ndisabled = false\nformat = \"on [$symbol$context($namespace )]($style) \"\nstyle = \"bold cyan\"",
    format: "$kubernetes",
    keyOptions: ["format", "symbol", "style", "disabled", "context_aliases", "user_aliases", "contexts"],
    variables: ["symbol", "context", "namespace", "user", "cluster"],
    adjustments: [
      "Use context_aliases to shorten generated cloud-provider context names.",
      "Use contexts for style and symbol changes that make production clusters unmistakable.",
      "Keep namespace conditional because some contexts do not report one.",
    ],
    related: ["aws"],
  },
] as const;

export function moduleReferenceBySlug(slug: string): ModuleReference | undefined {
  return MODULE_REFERENCES.find((reference) => reference.slug === slug);
}

export function moduleBuilderHref(reference: ModuleReference): string {
  const parsed = parseConfig(reference.example);
  if (!parsed.ok) throw new Error(`Invalid module reference example: ${reference.slug}`);
  return `/#${encodeShare({ ...parsed.config, format: reference.format })}`;
}
