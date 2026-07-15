import { describe, expect, it } from 'vitest';

import { stripQueryString } from '../redact.js';

describe('stripQueryString', () => {
  it.each([
    ['https://example.com/path?a=1&b=2', 'https://example.com/path'],
    ['https://example.com/path', 'https://example.com/path'],
    ['https://example.com/path?', 'https://example.com/path'],
    ['https://example.com/checkout?session=abc&email=user%40example.com', 'https://example.com/checkout'],
    ['', ''],
    ['?leading', ''],
  ])('stripQueryString(%s) === %s', (input, want) => {
    expect(stripQueryString(input)).toBe(want);
  });
});
