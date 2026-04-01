// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[#*_~`>[\]()!|-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}
