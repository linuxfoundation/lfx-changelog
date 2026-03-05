// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Bumps the patch component of a semantic version string.
 * Handles common formats: "2.5.0", "2.5", "2".
 * Returns "0.0.1" if the input is null, empty, or unparseable.
 */
export function bumpPatchVersion(version: string | null | undefined): string {
  if (!version?.trim()) return '0.0.1';

  const cleaned = version.trim().replace(/^v/i, '');
  const parts = cleaned.split('.').map(Number);

  const major = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minor = Number.isFinite(parts[1]) ? parts[1] : 0;
  const patch = Number.isFinite(parts[2]) ? parts[2] : 0;

  return `${major}.${minor}.${patch + 1}`;
}
