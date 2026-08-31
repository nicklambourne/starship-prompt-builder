/**
 * The core (non-language, non-cloud) starship modules.
 *
 * `env_var` and `custom` are table modules: the entries here are the keyless
 * instances, and `createEnvVarModule` / `createCustomModule` build one
 * definition per key a config declares (`[env_var.FOO]` → `env_var.FOO`).
 */

import { battery } from "./battery";
import { character } from "./character";
import { cmd_duration } from "./cmd_duration";
import { container } from "./container";
import { custom } from "./custom";
import { directory } from "./directory";
import { env_var } from "./env_var";
import { fill } from "./fill";
import { git_branch } from "./git_branch";
import { git_commit } from "./git_commit";
import { git_metrics } from "./git_metrics";
import { git_state } from "./git_state";
import { git_status } from "./git_status";
import { hostname } from "./hostname";
import { jobs } from "./jobs";
import { line_break } from "./line_break";
import { localip } from "./localip";
import { memory_usage } from "./memory_usage";
import { os } from "./os";
import { shell } from "./shell";
import { status } from "./status";
import { sudo } from "./sudo";
import { time } from "./time";
import type { ModuleDefinition } from "./types";
import { username } from "./username";

export const CORE_MODULES: ModuleDefinition[] = [
  username,
  hostname,
  localip,
  shell,
  container,
  os,
  directory,
  git_branch,
  git_commit,
  git_state,
  git_metrics,
  git_status,
  env_var,
  custom,
  sudo,
  memory_usage,
  cmd_duration,
  jobs,
  battery,
  time,
  status,
  fill,
  line_break,
  character,
];
