// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

// OTel SDK is initialized in otel.mjs via `node --import ./otel.mjs`.
// Re-export the API so application code (logger mixin) can access active spans.
export { context, trace } from '@opentelemetry/api';
