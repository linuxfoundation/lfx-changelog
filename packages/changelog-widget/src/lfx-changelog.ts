// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { fetchChangelogs } from './api.js';
import { renderEmpty, renderError, renderFooter, renderHeader, renderList, renderLoading } from './renderer.js';
import { WIDGET_STYLES } from './styles.js';

import type { ChangelogEntry } from './types.js';

const DEFAULT_BASE_URL = 'https://changelog.lfx.dev';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// SSR-safe base class — avoids ReferenceError when HTMLElement is not defined (e.g., Node.js/Next.js/Nuxt)
const SafeHTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

export class LfxChangelogElement extends SafeHTMLElement {
  static readonly observedAttributes = ['product', 'theme', 'limit', 'base-url'];

  private shadow: ShadowRoot;
  private abortController: AbortController | null = null;
  private containerElement: HTMLDivElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });

    const styleElement = document.createElement('style');
    styleElement.textContent = WIDGET_STYLES;
    this.shadow.appendChild(styleElement);

    this.containerElement = document.createElement('div');
    this.containerElement.setAttribute('part', 'container');
    this.containerElement.classList.add('lfx-changelog');
    this.shadow.appendChild(this.containerElement);
  }

  // ── Attribute accessors ────────────────────────

  get product(): string {
    return this.getAttribute('product') || '';
  }

  get theme(): 'light' | 'dark' {
    return (this.getAttribute('theme') as 'light' | 'dark') || 'light';
  }

  get limit(): number {
    const val = parseInt(this.getAttribute('limit') || '', 10);
    if (isNaN(val) || val < 1) return DEFAULT_LIMIT;
    return Math.min(val, MAX_LIMIT);
  }

  get baseUrl(): string {
    return this.getAttribute('base-url') || DEFAULT_BASE_URL;
  }

  // ── Lifecycle ──────────────────────────────────

  connectedCallback(): void {
    if (!this.product) {
      this.showError('Missing required "product" attribute');
      return;
    }
    this.loadChangelogs();
  }

  disconnectedCallback(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;

    if (name === 'product' || name === 'limit' || name === 'base-url') {
      if (this.isConnected && this.product) {
        this.loadChangelogs();
      }
    }
    // Theme changes are handled via CSS :host([theme="dark"]) — no re-render needed
  }

  // ── Data loading ───────────────────────────────

  private async loadChangelogs(): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();

    this.showLoading();

    try {
      const response = await fetchChangelogs(this.product, this.limit, this.baseUrl, this.abortController.signal);

      if (response.data.length === 0) {
        this.showEmpty();
      } else {
        this.showEntries(response.data);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      const message = error instanceof Error ? error.message : 'Failed to load changelogs';
      this.showError(message);
    }
  }

  // ── Render states ──────────────────────────────

  private clearContainer(): void {
    while (this.containerElement.firstChild) {
      this.containerElement.removeChild(this.containerElement.firstChild);
    }
  }

  private showLoading(): void {
    this.clearContainer();
    this.containerElement.appendChild(renderHeader("What's New"));
    this.containerElement.appendChild(renderLoading());
  }

  private showEntries(entries: ChangelogEntry[]): void {
    const productName = entries[0]?.product?.name;
    const heading = productName ? `What's New in ${productName}` : "What's New";

    this.clearContainer();
    this.containerElement.appendChild(renderHeader(heading));

    const listWrapper = document.createElement('div');
    listWrapper.setAttribute('part', 'list');
    listWrapper.classList.add('lfx-list');
    listWrapper.appendChild(renderList(entries, this.baseUrl));
    this.containerElement.appendChild(listWrapper);

    this.containerElement.appendChild(renderFooter(this.baseUrl));
  }

  private showError(message: string): void {
    this.clearContainer();
    this.containerElement.appendChild(renderHeader("What's New"));

    const errorEl = renderError(message);
    this.containerElement.appendChild(errorEl);

    const retryBtn = errorEl.querySelector('.lfx-retry-btn');
    retryBtn?.addEventListener('click', () => this.loadChangelogs());
  }

  private showEmpty(): void {
    this.clearContainer();
    this.containerElement.appendChild(renderHeader("What's New"));
    this.containerElement.appendChild(renderEmpty());
  }
}
