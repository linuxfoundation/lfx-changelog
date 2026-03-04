// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export const BOT_EMAIL = 'changelog-bot@linuxfoundation.org';
export const BOT_NAME = 'LFX Changelog Bot';
export const DEFAULT_LOOKBACK_DAYS = 30;

/** Auto-changelog locks older than this are considered stale (crashed process) and can be reclaimed. */
export const STALE_LOCK_MS = 10 * 60 * 1000; // 10 minutes
