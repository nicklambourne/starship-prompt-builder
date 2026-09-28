import React from "react";
import { render } from "ink-testing-library";
import { expect, it, vi } from "vitest";
import { TextInput } from "./TextInput";

it("renders hostile defaults and suggestions safely without changing submitted bytes", async () => {
  const source = "prefix\x1b]52;c;synthetic\x07\x9b2J";
  const submitted = vi.fn();
  const app = render(<TextInput defaultValue={source} suggestions={[source + "\x1b]title\x07"]} onSubmit={submitted} />);
  expect(app.lastFrame()).not.toMatch(/[\x00-\x1f\x7f-\x9f]/);
  await vi.waitFor(() => expect(app.lastFrame()).toContain("synthetic?"));
  // Ink attaches its input listener in an effect.
  await new Promise((resolve) => setTimeout(resolve, 20));
  app.stdin.write("\r");
  await vi.waitFor(() => expect(submitted).toHaveBeenCalledWith(source + "\x1b]title\x07"));
  app.unmount();
});

it("edits a grapheme without splitting its source and does not delete at the start", async () => {
  const submitted = vi.fn();
  const app = render(<TextInput defaultValue="漢👩‍💻" onSubmit={submitted} />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  app.stdin.write("\u007f");
  await vi.waitFor(() => expect(app.lastFrame()).not.toContain("👩"));
  app.stdin.write("\u001b[D");
  await new Promise((resolve) => setTimeout(resolve, 20));
  app.stdin.write("\u007f");
  app.stdin.write("\r");
  await vi.waitFor(() => expect(submitted).toHaveBeenCalledWith("漢"));
  app.unmount();
});
