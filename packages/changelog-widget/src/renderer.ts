// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import DOMPurify from 'dompurify';
import { marked } from 'marked';

import type { ChangelogEntry } from './types.js';

marked.setOptions({
  async: false,
  gfm: true,
  breaks: true,
});

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function sanitizeMarkdown(md: string): string {
  const rawHtml = marked.parse(md) as string;
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
  });
}

/**
 * Safely sets sanitized HTML content on an element using DOMPurify.
 * This is the ONLY place in the widget where HTML is injected into the DOM,
 * and the content has already been sanitized by DOMPurify above.
 */
function setSanitizedContent(element: HTMLElement, sanitizedHtml: string): void {
  const template = document.createElement('template');
  template.innerHTML = sanitizedHtml; // eslint-disable-line no-unsanitized/property -- content is DOMPurify-sanitized
  element.appendChild(template.content.cloneNode(true));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string>, children?: (Node | string)[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
  }
  if (children) {
    for (const child of children) {
      element.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return element;
}

export function renderCard(entry: ChangelogEntry, baseUrl: string): HTMLElement {
  const entryUrl = `${baseUrl}/entry/${entry.slug || entry.id}`;
  const date = entry.publishedAt ? formatDate(entry.publishedAt) : formatDate(entry.createdAt);

  const metaChildren: (Node | string)[] = [];
  if (entry.version) {
    metaChildren.push(el('span', { part: 'version', class: 'lfx-version' }, [`v${entry.version}`]));
  }
  metaChildren.push(el('time', { part: 'date', class: 'lfx-date', datetime: entry.publishedAt || entry.createdAt }, [date]));

  const link = el('a', { class: 'lfx-card-link', href: entryUrl, target: '_blank', rel: 'noopener noreferrer' }, [
    el('div', { part: 'meta', class: 'lfx-meta' }, metaChildren),
    el('h3', { part: 'title', class: 'lfx-title' }, [entry.title]),
  ]);

  const description = el('div', { part: 'description', class: 'lfx-description' });
  setSanitizedContent(description, sanitizeMarkdown(entry.description));

  return el('article', { part: 'card', class: 'lfx-card' }, [link, description]);
}

export function renderList(entries: ChangelogEntry[], baseUrl: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    fragment.appendChild(renderCard(entry, baseUrl));
  }
  return fragment;
}

export function renderLoading(): HTMLElement {
  const container = el('div', { part: 'loading', class: 'lfx-loading' });
  for (let i = 0; i < 3; i++) {
    const skeleton = el('div', { class: 'lfx-skeleton' });
    for (let j = 0; j < 4; j++) {
      skeleton.appendChild(el('div', { class: 'lfx-skeleton-line' }));
    }
    container.appendChild(skeleton);
  }
  return container;
}

export function renderError(message: string): HTMLElement {
  const retryBtn = el('button', { part: 'retry', class: 'lfx-retry-btn' }, ['Retry']);

  return el('div', { part: 'error', class: 'lfx-error' }, [
    el('div', { class: 'lfx-error-icon' }, ['\u26A0']),
    el('div', { class: 'lfx-error-message' }, [message]),
    retryBtn,
  ]);
}

export function renderEmpty(): HTMLElement {
  return el('div', { part: 'empty', class: 'lfx-empty' }, ['No changelog entries found.']);
}

export function renderFooter(baseUrl: string): HTMLElement {
  return el('div', { part: 'footer', class: 'lfx-footer' }, [
    el('a', { part: 'link', class: 'lfx-footer-link', href: baseUrl, target: '_blank', rel: 'noopener noreferrer' }, ['View all changelogs \u2192']),
  ]);
}

export function renderHeader(text: string): HTMLElement {
  return el('div', { part: 'header', class: 'lfx-header' }, [el('h2', { part: 'heading', class: 'lfx-heading' }, [text])]);
}
