/**
 * Barrel for the cloud / context / VCS-adjacent modules.
 *
 * Registration order is irrelevant to rendering — `$all` follows the config's
 * canonical order — so these are listed alphabetically by module name, as
 * starship's own `ALL_MODULES` is.
 */

import { aws } from "./aws";
import { azure } from "./azure";
import { conda } from "./conda";
import { dockerContext } from "./docker_context";
import { gcloud } from "./gcloud";
import { guixShell } from "./guix_shell";
import { hgBranch } from "./hg_branch";
import { kubernetes } from "./kubernetes";
import { nixShell } from "./nix_shell";
import { openstack } from "./openstack";
import { pulumi } from "./pulumi";
import { singularity } from "./singularity";
import { spack } from "./spack";
import { terraform } from "./terraform";
import type { ModuleDefinition } from "./types";
import { vcsh } from "./vcsh";
import { vcs } from "./vcs";

export const CLOUD_MODULES: ModuleDefinition[] = [
  aws,
  azure,
  conda,
  dockerContext,
  gcloud,
  guixShell,
  hgBranch,
  kubernetes,
  nixShell,
  openstack,
  pulumi,
  singularity,
  spack,
  terraform,
  vcs,
  vcsh,
];
