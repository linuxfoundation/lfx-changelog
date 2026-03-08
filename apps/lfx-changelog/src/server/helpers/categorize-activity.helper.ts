// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ChangelogCategory } from '@lfx-changelog/shared';

const CONVENTIONAL_PREFIX_MAP: Record<string, ChangelogCategory> = {
  feat: ChangelogCategory.FEATURE,
  feature: ChangelogCategory.FEATURE,
  fix: ChangelogCategory.BUGFIX,
  bugfix: ChangelogCategory.BUGFIX,
  perf: ChangelogCategory.IMPROVEMENT,
  refactor: ChangelogCategory.IMPROVEMENT,
  improvement: ChangelogCategory.IMPROVEMENT,
  security: ChangelogCategory.SECURITY,
  sec: ChangelogCategory.SECURITY,
  deprecate: ChangelogCategory.DEPRECATION,
  deprecated: ChangelogCategory.DEPRECATION,
};

const KEYWORD_PATTERNS: [RegExp, ChangelogCategory][] = [
  [/\b(add|new|introduc|implement|creat)\w*\b/i, ChangelogCategory.FEATURE],
  [/\b(fix|resolv|correct|patch|repair|bug)\w*\b/i, ChangelogCategory.BUGFIX],
  [/\b(improv|enhanc|optimiz|upgrad|refactor|performance|speed)\w*\b/i, ChangelogCategory.IMPROVEMENT],
  [/\b(secur|vulnerabilit|cve|xss|csrf|injection|auth)\w*\b/i, ChangelogCategory.SECURITY],
  [/\b(deprecat|sunset|remov|drop support)\w*\b/i, ChangelogCategory.DEPRECATION],
  [/\bBREAKING[ _]CHANGE\b/i, ChangelogCategory.BREAKING_CHANGE],
  [/\b(breaking|incompatible|migration required)\b/i, ChangelogCategory.BREAKING_CHANGE],
];

/**
 * Heuristically categorizes a commit message or PR title into a ChangelogCategory.
 *
 * Strategy:
 * 1. Parse conventional commit prefix (e.g., `feat:`, `fix(scope):`)
 * 2. Check for BREAKING CHANGE marker
 * 3. Fall back to keyword matching
 * 4. Default to `other`
 */
export function categorizeActivity(text: string): ChangelogCategory {
  const trimmed = text.trim();

  // Check for BREAKING CHANGE first (highest priority)
  if (/\bBREAKING[ _]CHANGE\b/i.test(trimmed)) {
    return ChangelogCategory.BREAKING_CHANGE;
  }

  // Parse conventional commit prefix: `type(scope)?!: message`
  const conventionalMatch = trimmed.match(/^(\w+)(?:\([^)]*\))?!?:\s/);
  if (conventionalMatch) {
    const prefix = conventionalMatch[1].toLowerCase();
    const mapped = CONVENTIONAL_PREFIX_MAP[prefix];
    if (mapped) return mapped;

    // Common non-user-facing prefixes
    if (['chore', 'ci', 'docs', 'test', 'tests', 'build', 'style'].includes(prefix)) {
      return ChangelogCategory.OTHER;
    }
  }

  // Keyword matching fallback
  for (const [pattern, category] of KEYWORD_PATTERNS) {
    if (pattern.test(trimmed)) {
      return category;
    }
  }

  return ChangelogCategory.OTHER;
}
