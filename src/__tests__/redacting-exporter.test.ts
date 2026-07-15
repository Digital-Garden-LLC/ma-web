import { describe, expect, it, vi } from 'vitest';
import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_URL_FULL } from '@opentelemetry/semantic-conventions';

import { RedactingExporter } from '../redacting-exporter.js';

function fakeSpan(attributes: Record<string, unknown>): ReadableSpan {
  return { attributes } as unknown as ReadableSpan;
}

class FakeExporter implements SpanExporter {
  received: ReadableSpan[] = [];
  shutdownCalled = false;
  forceFlushCalled = false;

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.received.push(...spans);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    this.shutdownCalled = true;
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    this.forceFlushCalled = true;
    return Promise.resolve();
  }
}

describe('RedactingExporter', () => {
  it('strips the query string from url.full before forwarding to the wrapped exporter', () => {
    const inner = new FakeExporter();
    const exporter = new RedactingExporter(inner);
    const span = fakeSpan({ [ATTR_URL_FULL]: 'https://example.com/checkout?session=abc123' });

    exporter.export([span], () => {});

    expect(inner.received).toHaveLength(1);
    expect(inner.received[0].attributes[ATTR_URL_FULL]).toBe('https://example.com/checkout');
  });

  it('leaves a span with no url.full attribute untouched', () => {
    const inner = new FakeExporter();
    const exporter = new RedactingExporter(inner);
    const span = fakeSpan({ 'service.name': 'storefront' });

    exporter.export([span], () => {});

    expect(inner.received[0].attributes).toEqual({ 'service.name': 'storefront' });
  });

  it('forwards the result callback from the wrapped exporter', () => {
    const inner = new FakeExporter();
    const exporter = new RedactingExporter(inner);
    const callback = vi.fn();

    exporter.export([fakeSpan({})], callback);

    expect(callback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
  });

  it('delegates shutdown and forceFlush to the wrapped exporter', async () => {
    const inner = new FakeExporter();
    const exporter = new RedactingExporter(inner);

    await exporter.shutdown();
    await exporter.forceFlush();

    expect(inner.shutdownCalled).toBe(true);
    expect(inner.forceFlushCalled).toBe(true);
  });
});
