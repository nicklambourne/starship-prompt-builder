const COMMANDS = "edit preview validate export share presets agent-guide completions";
const OPTIONS = "--config --preset --scenario --width --json --strict --no-color --full --from-share --help --version";

export function shellCompletion(shell: string): string {
  if (shell === "bash") return `# bash completion for starship-builder and spb\n_spb_complete() {\n  local current="${"${COMP_WORDS[COMP_CWORD]}"}"\n  COMPREPLY=( $(compgen -W '${COMMANDS} ${OPTIONS}' -- "$current") )\n}\ncomplete -F _spb_complete starship-builder spb\n`;
  if (shell === "zsh") return `#compdef starship-builder spb\n_spb_complete() {\n  local -a choices\n  choices=(${COMMANDS} ${OPTIONS})\n  _describe 'command or option' choices\n}\n_spb_complete "$@"\n`;
  if (shell === "fish") return `# fish completion for starship-builder and spb\nfor binary in starship-builder spb\n  complete -c $binary -f\n  for command in ${COMMANDS}\n    complete -c $binary -n '__fish_use_subcommand' -a $command\n  end\n  for option in ${OPTIONS}\n    complete -c $binary -l (string sub -s 3 $option)\n  end\nend\n`;
  throw new Error(`Unsupported completion shell: ${shell}. Choose bash, zsh, or fish.`);
}
