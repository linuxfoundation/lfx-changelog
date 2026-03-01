// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export const AUTH_ERROR = {
  content: [
    {
      type: 'text' as const,
      text: 'Authentication required. Set the LFX_API_KEY environment variable or pass an API key via the Authorization header. You can create an API key in the LFX Changelog admin panel under Settings > API Keys.',
    },
  ],
  isError: true,
};
