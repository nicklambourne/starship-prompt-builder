# Production security headers

The application is exported to GitHub Pages and proxied by Cloudflare. GitHub
Pages cannot set arbitrary response headers, and files such as _headers are
ignored there. Configure these values at the Cloudflare edge with a Response
Header Transform Rule scoped to starship.ndl.au.

Set the following response headers:

- Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src
  'self'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src
  'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src
  'self' 'unsafe-inline'; upgrade-insecure-requests
- Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(),
  usb=()
- Referrer-Policy: strict-origin-when-cross-origin
- X-Content-Type-Options: nosniff

The CSP permits inline scripts and styles because the static Next.js export
contains inline hydration data, the pre-paint theme bootstrap, structured data,
and inline swatch styles. Removing unsafe-inline requires nonce or hash support
through a response-aware deployment layer; do not remove it without testing the
exported application.

After changing the edge rule, verify the response rather than only the HTML:

    curl -sS -D - -o /dev/null https://starship.ndl.au/

Then run the browser and accessibility suite. The document metadata also emits
the referrer policy so direct copies of the export retain that protection, but
the Cloudflare response header remains the production source of truth.

## Verification and ownership

Run `pnpm check:headers`. It checks root, guide, module, asset and 404 responses
with curl, without following redirects or collecting response bodies. On
2026-09-29 this check still failed for all four required headers in production.
The app-side check is implemented; the edge deployment is **not complete**.

The infrastructure maintainer must locate the existing Response Header Transform
Ruleset for the `ndl.au` zone and scope the approved rule to
`http.host eq "starship.ndl.au"`. Preserve existing HSTS and unrelated rules.
Save the current ruleset for rollback, test the policy in a controlled environment
(or CSP report-only first), then apply through the infrastructure repository.
Never claim completion from this document or an HTML meta tag alone.

After rollout, test hydration, font requests, both themes, sharing and downloads,
then run the smoke check. If blocked, restore the previous edge rule through that
same reviewed infrastructure workflow. No edge credentials belong in this repo.
