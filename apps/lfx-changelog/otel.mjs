// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

// OpenTelemetry SDK initialization — loaded via `node --import ./otel.mjs`
// before the application bundle. Plain ESM, no TypeScript compilation needed.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'lfx-changelog',
  [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? 'development',
});

// Normalize the OTLP base URL: treat empty/whitespace as unset, strip trailing slash.
const otlpBase = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || 'http://localhost:4318').replace(/\/$/, '');

const traceExporter = new OTLPTraceExporter({
  url: `${otlpBase}/v1/traces`,
});

const metricExporter = new OTLPMetricExporter({
  url: `${otlpBase}/v1/metrics`,
});

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReaders: [new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60_000,
  })],
  instrumentations: [
    getNodeAutoInstrumentations({
      // fs instrumentation is very noisy (every file read/write)
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Skip localhost requests — Angular SSR internal fetches that carry
      // non-ASCII cookie headers violating the ByteString constraint
      '@opentelemetry/instrumentation-undici': {
        ignoreRequestHook: (request) => {
          try {
            const url = new URL(request.path, request.origin);
            return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
          } catch {
            return false;
          }
        },
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .finally(() => process.exit(0));
});
