// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Activity categories used internally to organize GitHub activity context for the agent.
 * These are NOT stored on changelog entries — they only structure the agent's input.
 */
export type ActivityCategory = 'feature' | 'bugfix' | 'improvement' | 'security' | 'deprecation' | 'breaking_change' | 'other';

const CONVENTIONAL_PREFIX_MAP: Record<string, ActivityCategory> = {
  feat: 'feature',
  feature: 'feature',
  fix: 'bugfix',
  bugfix: 'bugfix',
  perf: 'improvement',
  refactor: 'improvement',
  improvement: 'improvement',
  security: 'security',
  sec: 'security',
  deprecate: 'deprecation',
  deprecated: 'deprecation',
};

const KEYWORD_PATTERNS: [RegExp, ActivityCategory][] = [
  [/\b(add|new|introduc|implement|creat)\w*\b/i, 'feature'],
  [/\b(fix|resolv|correct|patch|repair|bug)\w*\b/i, 'bugfix'],
  [/\b(improv|enhanc|optimiz|upgrad|refactor|performance|speed)\w*\b/i, 'improvement'],
  [/\b(secur|vulnerabilit|cve|xss|csrf|injection|auth)\w*\b/i, 'security'],
  [/\b(deprecat|sunset|remov|drop support)\w*\b/i, 'deprecation'],
  [/\bBREAKING[ _]CHANGE\b/i, 'breaking_change'],
  [/\b(breaking|incompatible|migration required)\b/i, 'breaking_change'],
];

/**
 * Heuristically categorizes a commit message or PR title into an ActivityCategory.
 *
 * Strategy:
 * 1. Parse conventional commit prefix (e.g., `feat:`, `fix(scope):`)
 * 2. Check for BREAKING CHANGE marker
 * 3. Fall back to keyword matching
 * 4. Default to `other`
 */
export function categorizeActivity(text: string): ActivityCategory {
  const trimmed = text.trim();

  // Check for BREAKING CHANGE first (highest priority)
  if (/\bBREAKING[ _]CHANGE\b/i.test(trimmed)) {
    return 'breaking_change';
  }

  // Parse conventional commit prefix: `type(scope)?!: message`
  const conventionalMatch = trimmed.match(/^(\w+)(?:\([^)]*\))?!?:\s/);
  if (conventionalMatch) {
    const prefix = conventionalMatch[1].toLowerCase();
    const mapped = CONVENTIONAL_PREFIX_MAP[prefix];
    if (mapped) return mapped;

    // Common non-user-facing prefixes
    if (['chore', 'ci', 'docs', 'test', 'tests', 'build', 'style'].includes(prefix)) {
      return 'other';
    }
  }

  // Keyword matching fallback
  for (const [pattern, category] of KEYWORD_PATTERNS) {
    if (pattern.test(trimmed)) {
      return category;
    }
  }

  return 'other';
}
