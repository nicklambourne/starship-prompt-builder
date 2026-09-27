import { chmod, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pty from "node-pty";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const scratch = process.platform === "darwin" && existsSync("/Volumes/Scratch") ? "/Volumes/Scratch" : tmpdir();
const directory = await mkdtemp(join(scratch, "starship-builder-terminal-"));
const configPath = join(directory, "starship.toml");

// node-pty 1.1.0's macOS prebuild tarball can lose the helper executable bit.
// This is a dev-only test dependency; repair only that exact helper in-place.
if (process.platform !== "win32") {
  const packageFile = fileURLToPath(import.meta.resolve("node-pty"));
  const helper = join(dirname(dirname(packageFile)), "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
  if (existsSync(helper) && !((await stat(helper)).mode & 0o111)) await chmod(helper, 0o755);
}

function start(args) {
  const env = { ...process.env, TERM: "xterm-256color" };
  // Ink suppresses live frames when CI is set, even inside a real PTY.
  // Exercise the same interactive rendering path users see in a terminal.
  delete env.CI;
  delete env.CONTINUOUS_INTEGRATION;
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  const terminal = pty.spawn(process.execPath, [cli, ...args], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: packageRoot,
    env,
  });
  let output = "";
  const data = terminal.onData((chunk) => { output += chunk; });
  let exit;
  let didExit = false;
  const exited = new Promise((resolve) => { exit = terminal.onExit((result) => { didExit = true; resolve(result); }); });
  return { terminal, exited, output: () => output, close: () => { data.dispose(); exit.dispose(); if (!didExit) terminal.kill(); } };
}

async function waitFor(session, phrase, phase) {
  const deadline = Date.now() + 12000;
  while (!session.output().includes(phrase)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${phase}: ${session.output().slice(-2000)}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function waitForNew(session, phrase, phase, from) {
  const deadline = Date.now() + 12000;
  while (!session.output().slice(from).includes(phrase)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${phase}: ${session.output().slice(-2000)}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function waitForExit(session, phase) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${phase}: ${session.output().slice(-2000)}`)), 10000);
    session.exited.then((result) => { clearTimeout(timer); resolve(result); });
  });
}

try {
  const session = start(["edit", configPath, "--preset", "plain-text-symbols", "--no-color"]);
  try {
    await waitFor(session, "FORMAT", "initial frame");
    const beforeNarrow = session.output().length;
    session.terminal.resize(50, 20);
    await waitForNew(session, "needs 60 columns", "minimum-width recovery screen", beforeNarrow);
    const beforeWide = session.output().length;
    session.terminal.resize(120, 36);
    await waitForNew(session, "FORMAT", "resized editing frame", beforeWide);
    session.terminal.write("n");
    await waitFor(session, "Changed prompt newline setting", "edit confirmation");
    session.terminal.write("\x13");
    await waitFor(session, "REVIEW SAVE", "save review");
    session.terminal.write("\r");
    await waitFor(session, "Saved ", "save confirmation");
    session.terminal.write("q");
    const result = await waitForExit(session, "normal quit");
    if (result.exitCode !== 0) throw new Error(`CLI exited with ${result.exitCode}`);
    const saved = await readFile(configPath, "utf8");
    if (!saved.includes("add_newline = false")) throw new Error("Interactive edit was not saved");
    // ConPTY can emit a bare SGR reset (ESC[m) even when the child uses no colors.
    const colorSgr = [...session.output().matchAll(/\x1b\[([0-9;]*)m/g)].find(([, params]) =>
      params.split(";").some((code) => /^(?:3[0-8]|4[0-8]|9[0-7]|10[0-7])$/.test(code)));
    if (colorSgr) throw new Error(`--no-color emitted ANSI color in interactive mode: ${JSON.stringify(colorSgr[0])}`);
  } finally { session.close(); }

  const interrupted = start(["edit", configPath, "--no-color"]);
  try {
    await waitFor(interrupted, "FORMAT", "interruptible frame");
    interrupted.terminal.write("\x03");
    await waitForExit(interrupted, "Ctrl+C terminal restoration");
  } finally { interrupted.close(); }

  process.stdout.write(`Verified ${process.platform} PTY/ConPTY open → edit → save → quit, resize, and Ctrl+C.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
} finally {
  try {
    await rm(directory, { recursive: true, force: true });
  } catch (error) {
    process.stderr.write(`Cannot remove PTY test directory: ${error}\n`);
    process.exitCode = 1;
  }
  // node-pty's ConPTY worker can keep the test runner alive after onExit.
  // All assertions and cleanup have finished; preserve their result explicitly.
  if (process.platform === "win32") process.exit(process.exitCode ?? 0);
}
