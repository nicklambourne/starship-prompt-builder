import { Builder } from "@/components/builder/Builder";

export default function Home() {
  return (
    <>
      {/*
        For crawlers that do not run scripts, and for anyone whose browser
        cannot. The app itself needs JavaScript — it renders a prompt — but a
        blank page tells nobody what this is. An h2: the statically rendered
        site header already holds the page's one h1.
      */}
      <noscript>
        <div style={{ padding: "1.5rem", maxWidth: "42rem", lineHeight: 1.6 }}>
          <h2>Starship Prompt Builder</h2>
          <p>
            A visual editor for <code>starship.toml</code>, the configuration
            file of the{" "}
            <a href="https://starship.rs">Starship cross-shell prompt</a>. Edit
            any of its modules, styles and format strings against a live
            preview of a simulated shell, then export the file that reproduces
            it. The editing happens in the browser; your config is never
            uploaded.
          </p>
          <p>
            It needs JavaScript to render the prompt. The source is at{" "}
            <a href="https://github.com/nicklambourne/starship-prompt-builder">
              github.com/nicklambourne/starship-prompt-builder
            </a>
            .
          </p>
        </div>
      </noscript>
      <Builder />
    </>
  );
}
