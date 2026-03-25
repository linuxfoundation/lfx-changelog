// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export const WIDGET_STYLES = /* css */ `
  :host {
    display: block;

    /* Typography */
    --lfx-font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --lfx-font-size-base: 14px;
    --lfx-font-size-sm: 12px;
    --lfx-font-size-lg: 16px;
    --lfx-font-size-xl: 20px;
    --lfx-line-height: 1.6;

    /* Colors — light defaults */
    --lfx-text-primary: #1a1a2e;
    --lfx-text-secondary: #64748b;
    --lfx-text-muted: #94a3b8;
    --lfx-text-link: #3b82f6;
    --lfx-text-link-hover: #2563eb;
    --lfx-bg-surface: #ffffff;
    --lfx-bg-surface-alt: #f8fafc;
    --lfx-border-color: #e2e8f0;
    --lfx-border-color-strong: #cbd5e1;
    --lfx-accent: #3b82f6;
    --lfx-accent-bg: #eff6ff;
    --lfx-code-bg: #f1f5f9;

    /* Layout */
    --lfx-border-radius: 12px;
    --lfx-border-radius-sm: 6px;
    --lfx-card-padding: 20px;
    --lfx-card-gap: 16px;

    font-family: var(--lfx-font-family);
    font-size: var(--lfx-font-size-base);
    line-height: var(--lfx-line-height);
    color: var(--lfx-text-primary);
  }

  /* Dark theme */
  :host([theme="dark"]) {
    --lfx-text-primary: #f1f5f9;
    --lfx-text-secondary: #94a3b8;
    --lfx-text-muted: #64748b;
    --lfx-text-link: #60a5fa;
    --lfx-text-link-hover: #93bbfd;
    --lfx-bg-surface: #1e293b;
    --lfx-bg-surface-alt: #0f172a;
    --lfx-border-color: #334155;
    --lfx-border-color-strong: #475569;
    --lfx-accent: #60a5fa;
    --lfx-accent-bg: #1e3a5f;
    --lfx-code-bg: #1e293b;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .lfx-changelog {
    background: var(--lfx-bg-surface);
    border-radius: var(--lfx-border-radius);
    border: 1px solid var(--lfx-border-color);
    overflow: hidden;
  }

  /* ── Header ───────────────────────────────────── */

  .lfx-header {
    padding: var(--lfx-card-padding);
    border-bottom: 1px solid var(--lfx-border-color);
    background: var(--lfx-bg-surface-alt);
  }

  .lfx-heading {
    font-size: var(--lfx-font-size-xl);
    font-weight: 700;
    color: var(--lfx-text-primary);
    margin: 0;
  }

  /* ── Card list ────────────────────────────────── */

  .lfx-list {
    display: flex;
    flex-direction: column;
  }

  .lfx-card {
    padding: var(--lfx-card-padding);
    border-bottom: 1px solid var(--lfx-border-color);
    transition: background-color 0.15s ease;
  }

  .lfx-card:last-child {
    border-bottom: none;
  }

  .lfx-card:hover {
    background: var(--lfx-bg-surface-alt);
  }

  .lfx-card-link {
    text-decoration: none;
    color: inherit;
    display: block;
  }

  .lfx-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .lfx-version {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    font-size: var(--lfx-font-size-sm);
    font-weight: 600;
    color: var(--lfx-accent);
    background: var(--lfx-accent-bg);
    border-radius: 9999px;
  }

  .lfx-date {
    font-size: var(--lfx-font-size-sm);
    color: var(--lfx-text-muted);
  }

  .lfx-title {
    font-size: var(--lfx-font-size-lg);
    font-weight: 600;
    color: var(--lfx-text-primary);
    margin-bottom: 8px;
  }

  .lfx-description {
    color: var(--lfx-text-secondary);
    font-size: var(--lfx-font-size-base);
    line-height: var(--lfx-line-height);
  }

  /* ── Markdown content styling ─────────────────── */

  .lfx-description h1,
  .lfx-description h2,
  .lfx-description h3,
  .lfx-description h4 {
    color: var(--lfx-text-primary);
    font-weight: 600;
    margin: 12px 0 8px;
  }

  .lfx-description h1 { font-size: 1.25em; }
  .lfx-description h2 { font-size: 1.15em; }
  .lfx-description h3 { font-size: 1.05em; }

  .lfx-description p {
    margin: 8px 0;
  }

  .lfx-description ul,
  .lfx-description ol {
    padding-left: 1.5em;
    margin: 8px 0;
  }

  .lfx-description li {
    margin: 4px 0;
  }

  .lfx-description code {
    background: var(--lfx-code-bg);
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .lfx-description pre {
    background: var(--lfx-code-bg);
    padding: 12px;
    border-radius: var(--lfx-border-radius-sm);
    overflow-x: auto;
    margin: 8px 0;
  }

  .lfx-description pre code {
    background: none;
    padding: 0;
  }

  .lfx-description a {
    color: var(--lfx-text-link);
    text-decoration: underline;
  }

  .lfx-description a:hover {
    color: var(--lfx-text-link-hover);
  }

  .lfx-description blockquote {
    border-left: 3px solid var(--lfx-border-color-strong);
    padding-left: 12px;
    margin: 8px 0;
    color: var(--lfx-text-secondary);
  }

  .lfx-description img {
    max-width: 100%;
    height: auto;
    border-radius: var(--lfx-border-radius-sm);
  }

  .lfx-description table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
  }

  .lfx-description th,
  .lfx-description td {
    border: 1px solid var(--lfx-border-color);
    padding: 8px;
    text-align: left;
  }

  .lfx-description th {
    background: var(--lfx-bg-surface-alt);
    font-weight: 600;
  }

  /* ── Footer ───────────────────────────────────── */

  .lfx-footer {
    padding: 16px var(--lfx-card-padding);
    border-top: 1px solid var(--lfx-border-color);
    text-align: center;
    background: var(--lfx-bg-surface-alt);
  }

  .lfx-footer-link {
    color: var(--lfx-text-link);
    text-decoration: none;
    font-size: var(--lfx-font-size-sm);
    font-weight: 500;
    transition: color 0.15s ease;
  }

  .lfx-footer-link:hover {
    color: var(--lfx-text-link-hover);
    text-decoration: underline;
  }

  /* ── Loading skeleton ─────────────────────────── */

  .lfx-loading {
    padding: var(--lfx-card-padding);
  }

  .lfx-skeleton {
    padding: 16px 0;
    border-bottom: 1px solid var(--lfx-border-color);
  }

  .lfx-skeleton:last-child {
    border-bottom: none;
  }

  .lfx-skeleton-line {
    height: 12px;
    background: var(--lfx-border-color);
    border-radius: 6px;
    margin-bottom: 8px;
    animation: lfx-pulse 1.5s ease-in-out infinite;
  }

  .lfx-skeleton-line:nth-child(1) { width: 30%; }
  .lfx-skeleton-line:nth-child(2) { width: 70%; height: 16px; }
  .lfx-skeleton-line:nth-child(3) { width: 90%; }
  .lfx-skeleton-line:nth-child(4) { width: 60%; }

  @keyframes lfx-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Error state ──────────────────────────────── */

  .lfx-error {
    padding: 32px var(--lfx-card-padding);
    text-align: center;
    color: var(--lfx-text-secondary);
  }

  .lfx-error-icon {
    font-size: 24px;
    margin-bottom: 8px;
  }

  .lfx-error-message {
    font-size: var(--lfx-font-size-sm);
  }

  .lfx-retry-btn {
    margin-top: 12px;
    padding: 6px 16px;
    font-size: var(--lfx-font-size-sm);
    font-weight: 500;
    color: var(--lfx-accent);
    background: transparent;
    border: 1px solid var(--lfx-accent);
    border-radius: var(--lfx-border-radius-sm);
    cursor: pointer;
    font-family: var(--lfx-font-family);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .lfx-retry-btn:hover {
    background: var(--lfx-accent);
    color: #fff;
  }

  /* ── Empty state ──────────────────────────────── */

  .lfx-empty {
    padding: 32px var(--lfx-card-padding);
    text-align: center;
    color: var(--lfx-text-muted);
    font-size: var(--lfx-font-size-sm);
  }
`;
