/**
 * Configuration for {@link initWebTracing}. See the README for a full
 * walkthrough; this is the reference for every field.
 */
export interface WebTracingConfig {
  /**
   * The miniargus ingest endpoint, e.g.
   * "https://ingest.example.com/v1/ingest/traces". Required.
   */
  endpoint: string;
  /**
   * A browser-safe public key (starts with "magpk_"), issued via the
   * tenant admin API's POST /admin/v1/tenants/{id}/public-keys -- see
   * SPEC.md's "Scope of Work -- Web Spans (Browser Tracing)". Never reuse
   * a server-side api_key here: it has no origin scoping and would hand
   * any site visitor full ingest access for your tenant. Required.
   */
  publicKey: string;
  /**
   * This site's service name -- what distinguishes it from other services
   * in miniargus's traces table and Grafana's $service dashboard
   * variable, the same role ma-go's WithServiceName plays server-side.
   * Required.
   */
  service: string;
  /**
   * Head-based sampling rate in [0, 1], consistent for every span in a
   * given page load (OTel's ParentBased + TraceIdRatioBased sampler --
   * the sampling decision is made once, on the root span, and every child
   * span inherits it). Real end-user traffic can be orders of magnitude
   * higher-volume than backend request traces -- every visitor, every
   * page, every resource fetch -- so this defaults conservatively rather
   * than to 1.0.
   *
   * @default 0.1
   */
  sampleRate?: number;
  /**
   * Origins your own backend runs on -- fetch/XHR calls to these origins
   * get a `traceparent` header injected, so miniargus can correlate this
   * page's spans with the backend's own (ma-go already parses incoming
   * traceparent -- see SPEC.md). Deliberately opt-in and explicit: do NOT
   * include third-party origins (analytics vendors, CDNs, ad networks)
   * here -- that would leak trace-context headers to services that have
   * no business seeing them. Passed straight through to
   * FetchInstrumentation's own propagateTraceHeaderCorsUrls.
   *
   * @default [] -- no trace-context propagation to any origin until you opt in
   */
  propagateTraceHeaderCorsUrls?: Array<string | RegExp>;
  /**
   * Strip query strings from every captured URL (page URL, fetch/XHR
   * URLs) before a span is exported -- query strings commonly carry PII
   * (session tokens, search terms, emails in poorly designed apps). This
   * is the only place redaction can be trusted, since anything sent to
   * miniargus has already left the browser even if the server redacted it
   * afterward too (which it also does, as defense in depth -- see
   * api/internal/otlp's stripQuery). Only disable this if you've reviewed
   * exactly what's in your own URLs' query strings and are comfortable
   * shipping it.
   *
   * @default true
   */
  redactQueryParams?: boolean;
}

export interface ResolvedWebTracingConfig {
  endpoint: string;
  publicKey: string;
  service: string;
  sampleRate: number;
  propagateTraceHeaderCorsUrls: Array<string | RegExp>;
  redactQueryParams: boolean;
}

/**
 * Validates and applies defaults to a WebTracingConfig. Throws a plain
 * Error with a specific, actionable message on invalid input -- this runs
 * once at page-load init time, so failing loudly and immediately beats
 * silently shipping no telemetry at all.
 */
export function resolveConfig(config: WebTracingConfig): ResolvedWebTracingConfig {
  if (!config.endpoint) {
    throw new Error('ma-web: config.endpoint is required');
  }
  if (!config.publicKey) {
    throw new Error('ma-web: config.publicKey is required');
  }
  if (!config.publicKey.startsWith('magpk_')) {
    throw new Error(
      'ma-web: config.publicKey does not look like a public key (expected a "magpk_" prefix) -- ' +
        'did you pass a server-side api_key by mistake? That key has no origin scoping and must never ship in browser JS.'
    );
  }
  if (!config.service) {
    throw new Error('ma-web: config.service is required');
  }

  const sampleRate = config.sampleRate ?? 0.1;
  if (sampleRate < 0 || sampleRate > 1) {
    throw new Error(`ma-web: config.sampleRate must be between 0 and 1, got ${sampleRate}`);
  }

  return {
    endpoint: config.endpoint,
    publicKey: config.publicKey,
    service: config.service,
    sampleRate,
    propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls ?? [],
    redactQueryParams: config.redactQueryParams ?? true,
  };
}
