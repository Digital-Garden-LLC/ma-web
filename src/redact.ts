/**
 * Strips everything from the first "?" onward. Query strings commonly carry
 * PII (session tokens, search terms, emails in poorly designed apps), so a
 * captured URL is never sent verbatim unless the caller explicitly opts
 * out via WebTracingConfig.redactQueryParams = false. This is the primary
 * redaction point -- the only place it can be trusted, since anything sent
 * over the network has already "left" the browser even if the server were
 * to redact it afterward. Mirrors miniargus's own server-side stripQuery
 * (api/internal/otlp/httpjson.go), which exists purely as defense in depth
 * for any other OTel Web SDK that doesn't redact client-side.
 */
export function stripQueryString(url: string): string {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}
