// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export const environment = {
  production: false,
  apiUrl: 'http://localhost:4204',
  datadog: {
    site: 'datadoghq.com',
    service: 'lfx-changelog',
    env: '', // Set to 'dev' value to test locally
  },
};
