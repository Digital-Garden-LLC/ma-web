import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

import { resolveConfig, type WebTracingConfig } from './config.js';
import { RedactingExporter } from './redacting-exporter.js';

export type { WebTracingConfig } from './config.js';

/**
 * Starts browser tracing: a root span for this page's document load, child
 * spans for its resource fetches, and a span for every subsequent
 * fetch()/XHR call the page makes -- all correlated with backend traces
 * via W3C trace-context propagation (ma-go's middleware already parses an
 * incoming `traceparent` header; see SPEC.md's "Scope of Work -- Web
 * Spans (Browser Tracing)").
 *
 * Call this once, as early as possible in your page's script -- before any
 * fetch calls or the document's own load event you want captured, e.g. at
 * the top of your entry bundle.
 *
 * A thin configuration wrapper around the real OpenTelemetry Web SDK, not
 * a reimplementation of it: this deliberately doesn't hand-roll
 * document-load/fetch instrumentation or W3C propagation, since the OTel
 * Web ecosystem already solves both robustly.
 *
 * Throws synchronously on invalid config (see resolveConfig) -- fails
 * loudly at init time rather than silently shipping no telemetry.
 */
export function initWebTracing(config: WebTracingConfig): void {
  const resolved = resolveConfig(config);

  const otlpExporter = new OTLPTraceExporter({
    url: resolved.endpoint,
    headers: { 'X-Public-Key': resolved.publicKey },
  });
  // Skip the wrapper (and the per-span attribute scan it does) entirely
  // for callers who've deliberately opted out, rather than making
  // RedactingExporter itself conditional internally.
  const exporter: SpanExporter = resolved.redactQueryParams
    ? new RedactingExporter(otlpExporter)
    : otlpExporter;

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: resolved.service }),
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(resolved.sampleRate) }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  provider.register();

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: resolved.propagateTraceHeaderCorsUrls,
        // Never trace ma-web's own span exports -- without this, every
        // batch POST to the ingest endpoint would itself generate a new
        // fetch span, feeding back into the next batch indefinitely.
        ignoreUrls: [resolved.endpoint],
      }),
    ],
  });
}
