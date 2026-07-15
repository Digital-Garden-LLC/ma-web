import type { ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_URL_FULL } from '@opentelemetry/semantic-conventions';

import { stripQueryString } from './redact.js';

/**
 * Wraps a SpanExporter and strips query strings from every span's url.full
 * attribute (what @opentelemetry/instrumentation-document-load and
 * -fetch actually set -- confirmed against their source) immediately
 * before export, if redactQueryParams is enabled. A SpanExporter wrapper,
 * not a per-instrumentation config hook: this is the single choke point
 * every span passes through right before leaving the browser, regardless
 * of which instrumentation produced it -- including any added later.
 */
export class RedactingExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    for (const span of spans) {
      const url = span.attributes[ATTR_URL_FULL];
      if (typeof url === 'string') {
        // readonly on `attributes` itself (the property can't be
        // reassigned) does not make its contents readonly -- mutating a
        // key in place is exactly what this needs and is legal here.
        (span.attributes as Record<string, unknown>)[ATTR_URL_FULL] = stripQueryString(url);
      }
    }
    this.inner.export(spans, resultCallback);
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush ? this.inner.forceFlush() : Promise.resolve();
  }
}
