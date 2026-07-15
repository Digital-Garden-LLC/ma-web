import { describe, expect, it } from 'vitest';

import { resolveConfig, type WebTracingConfig } from '../config.js';

const validConfig: WebTracingConfig = {
  endpoint: 'https://ingest.example.com/v1/ingest/traces',
  publicKey: 'magpk_abc123',
  service: 'storefront',
};

describe('resolveConfig', () => {
  it('applies defaults for optional fields', () => {
    const resolved = resolveConfig(validConfig);
    expect(resolved.sampleRate).toBe(0.1);
    expect(resolved.propagateTraceHeaderCorsUrls).toEqual([]);
    expect(resolved.redactQueryParams).toBe(true);
  });

  it('preserves explicit optional values, including an explicit false', () => {
    const resolved = resolveConfig({
      ...validConfig,
      sampleRate: 1,
      propagateTraceHeaderCorsUrls: ['https://api.example.com'],
      redactQueryParams: false,
    });
    expect(resolved.sampleRate).toBe(1);
    expect(resolved.propagateTraceHeaderCorsUrls).toEqual(['https://api.example.com']);
    expect(resolved.redactQueryParams).toBe(false);
  });

  it('throws when endpoint is missing', () => {
    expect(() => resolveConfig({ ...validConfig, endpoint: '' })).toThrow(/endpoint is required/);
  });

  it('throws when publicKey is missing', () => {
    expect(() => resolveConfig({ ...validConfig, publicKey: '' })).toThrow(/publicKey is required/);
  });

  it('throws a specific error when publicKey looks like a server-side api_key', () => {
    expect(() => resolveConfig({ ...validConfig, publicKey: 'mag_serversidekey' })).toThrow(
      /does not look like a public key/
    );
  });

  it('throws when service is missing', () => {
    expect(() => resolveConfig({ ...validConfig, service: '' })).toThrow(/service is required/);
  });

  it.each([-0.1, 1.1, -1, 2])('throws when sampleRate is out of range (%s)', (sampleRate) => {
    expect(() => resolveConfig({ ...validConfig, sampleRate })).toThrow(/sampleRate must be between 0 and 1/);
  });

  it.each([0, 0.5, 1])('accepts boundary and mid-range sampleRate values (%s)', (sampleRate) => {
    expect(() => resolveConfig({ ...validConfig, sampleRate })).not.toThrow();
  });
});
