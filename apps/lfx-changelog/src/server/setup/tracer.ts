// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

// dd-trace must be imported before any other module to monkey-patch correctly.
// Only initialize in production where a Datadog agent is reachable.
// NODE_ENV is set as a system env var in K8s (not from .env), so it's available here.
if (process.env['NODE_ENV'] === 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tracer = require('dd-trace');
  tracer.init({
    service: 'lfx-changelog',
    logInjection: true,
    runtimeMetrics: true,
  });

  // Disable fetch instrumentation — Angular SSR uses FetchBackend which forwards
  // browser cookies as headers. Non-ASCII characters in cookies (e.g. URL-decoded
  // values like ') violate the ByteString constraint and crash the request.
  tracer.use('fetch', false);
}
