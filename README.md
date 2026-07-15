# ma-web

Browser SDK for miniargus, a self-hosted observability platform. Captures
page-load and fetch/XHR spans from real visitors' browsers and correlates
them with your backend's own traces via W3C trace context — the browser
half of the same `traces` pipeline `ma-go`'s HTTP middleware already feeds
server-side.

```sh
npm install @digital-garden-llc/ma-web
```

A thin configuration wrapper around the real
[OpenTelemetry Web SDK](https://opentelemetry.io/docs/languages/js/) — not
a reimplementation of it. `ma-web` doesn't hand-roll document-load/fetch
instrumentation or trace-context propagation; it configures the packages
that already do that well, points them at your miniargus tenant, and adds
the parts specific to this deployment (a browser-safe credential, sane
default sampling, query-string redaction).

## Usage

```ts
import { initWebTracing } from '@digital-garden-llc/ma-web';

initWebTracing({
  endpoint: 'https://ingest.example.com/v1/ingest/traces',
  publicKey: 'magpk_...', // issued via your miniargus admin API -- see below
  service: 'storefront',
  sampleRate: 0.2, // default 0.1 -- real visitor traffic can be high-volume
  propagateTraceHeaderCorsUrls: ['https://api.example.com'], // your own backend only
});
```

Call this once, as early as possible in your page's entry script — before
any `fetch()` calls or the document load you want captured.

## Getting a public key

A public key is a **browser-safe** credential, distinct from your tenant's
server-side `api_key`: it's scoped to just `POST /v1/ingest/traces`, and to
a set of allowed origins you register it with. Never use your `api_key`
here — that key has no origin scoping and would hand any site visitor full
ingest access for your tenant.

```sh
curl -X POST https://api.example.com/admin/v1/tenants/<tenant-id>/public-keys \
  -d '{"allowed_origins": ["https://shop.example.com"]}'
```

`allowed_origins` supports a `*.` wildcard segment for subdomains (e.g.
`"https://*.example.com"`) — a wildcard entry doesn't imply the bare
domain, which needs its own exact entry too. See your miniargus
deployment's setup docs for the full admin API reference.

## What gets captured

- **Page loads** (`@opentelemetry/instrumentation-document-load`): one root
  span per navigation, covering the full document load, plus child spans
  for the network phases of the document fetch and for every resource the
  page loads (scripts, stylesheets, images, fonts).
- **fetch()/XHR calls** (`@opentelemetry/instrumentation-fetch`): one
  `CLIENT`-kind span per outgoing request the page makes after load.

Spans land in miniargus's `traces` table exactly like backend spans do —
same OTLP-compatible shape, distinguished by `kind = 'client'` so
dashboards can tell a browser span from a backend one. See your
deployment's "Web Spans" dashboard.

## Correlating with your backend

`propagateTraceHeaderCorsUrls` controls which origins get a `traceparent`
header injected on outgoing `fetch()`/XHR calls. Set it to your own
backend's origin(s) so `ma-go` (which already parses an incoming
`traceparent`) links this page's trace to the backend request it triggers.

**Only list origins you own.** A `traceparent` header leaked to a
third-party origin (an analytics vendor, a CDN, an ad network) exposes
your internal trace/span IDs to it for no benefit — this is opt-in and
explicit for exactly that reason. The default is an empty list: no
propagation to any origin until you add one.

## Privacy: query-string redaction

By default (`redactQueryParams: true`), every captured URL — the page URL
and every fetch/XHR URL — has its query string stripped before a span
ever leaves the browser. Query strings commonly carry PII: session tokens,
search terms, sometimes emails in poorly designed apps. This is the only
place that redaction can be trusted, since anything sent over the network
has already left the browser even if a server redacted it afterward
(miniargus's ingestion API does that too, as defense in depth — see its
own docs — but don't rely on it as the primary control).

Only set `redactQueryParams: false` if you've reviewed exactly what's in
your own URLs' query strings and are comfortable shipping it as-is.

## Sampling

`sampleRate` (default `0.1`) is head-based and consistent per page load —
the sampling decision is made once, on the root span, and every child span
(resource fetches, subsequent API calls) inherits it. Real end-user
traffic can be orders of magnitude higher-volume than backend request
traces (every visitor, every page, every asset), so this defaults
conservatively rather than to `1.0`. Raise it for a low-traffic site, or
while debugging a specific issue.

## Bundler requirements

Needs a bundler that resolves the standard `"browser"` field in
`package.json` (webpack, Vite, esbuild, Rollup, Parcel — every mainstream
web bundler does this by default). This is a normal requirement for any
OpenTelemetry Web SDK usage, not something specific to `ma-web`.

## Non-JS/TS frontends

If you're already instrumented with OpenTelemetry's browser SDK directly,
you can skip this package: point its `OTLPTraceExporter` (**JSON encoding,
not protobuf** — the ingestion API only decodes OTLP/HTTP JSON, same
constraint as `ma-go`'s server-side note) at your miniargus deployment's
`POST /v1/ingest/traces`, with an `X-Public-Key` header carrying your
tenant's public key. See your miniargus deployment's setup docs for the
exact endpoint.

## Versioning

Pre-1.0: the API may still change. Pin a specific version if you need
stability, and check the changelog (commit history for now) before
upgrading.

## License

Apache 2.0 — see [LICENSE](LICENSE).
