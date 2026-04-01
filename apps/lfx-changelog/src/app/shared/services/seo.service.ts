// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { inject, Injectable, TransferState } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DEFAULT_OG_IMAGE, DEFAULT_SEO_DESCRIPTION, SITE_NAME } from '@lfx-changelog/shared';
import { getRuntimeConfig } from '@shared/providers/runtime-config/runtime-config.provider';

import type { PageMetaOptions } from '@shared/interfaces/seo.interface';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly baseUrl = getRuntimeConfig(inject(TransferState)).baseUrl || '';

  public setPageMeta(options: PageMetaOptions): void {
    const pageTitle = `${options.title} — ${SITE_NAME}`;
    const description = options.description || DEFAULT_SEO_DESCRIPTION;
    const url = options.url ? `${this.baseUrl}${options.url}` : '';
    const image = options.image || `${this.baseUrl}${DEFAULT_OG_IMAGE}`;
    const type = options.type || 'website';

    // Basic meta
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:image', content: image });
    if (url) {
      this.meta.updateTag({ property: 'og:url', content: url });
    }

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    // Article-specific
    if (options.publishedAt) {
      this.meta.updateTag({ property: 'article:published_time', content: options.publishedAt });
    }
    if (options.author) {
      this.meta.updateTag({ property: 'article:author', content: options.author });
    }
  }

  public resetToDefaults(): void {
    this.title.setTitle(SITE_NAME);
    this.meta.updateTag({ name: 'description', content: DEFAULT_SEO_DESCRIPTION });
    this.meta.updateTag({ property: 'og:title', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:description', content: DEFAULT_SEO_DESCRIPTION });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:image', content: `${this.baseUrl}${DEFAULT_OG_IMAGE}` });

    this.meta.removeTag("property='og:url'");
    this.meta.removeTag("property='article:published_time'");
    this.meta.removeTag("property='article:author'");
  }
}
