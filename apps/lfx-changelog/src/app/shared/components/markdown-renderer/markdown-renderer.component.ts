// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked, type Tokens } from 'marked';

const CALLOUT_REGEX = /^\s*<p>\[!(STATS|HIGHLIGHT|MILESTONE)\]\s*\n?(.*?)<\/p>/s;

marked.use({
  renderer: {
    blockquote({ tokens }: Tokens.Blockquote): string {
      const innerHtml = this.parser.parse(tokens);
      const match = innerHtml.match(CALLOUT_REGEX);
      if (!match) return `<blockquote>${innerHtml}</blockquote>\n`;

      const type = match[1].toLowerCase();
      const remaining = match[2]?.trim();
      const content = innerHtml.replace(CALLOUT_REGEX, remaining ? `<p>${remaining}</p>` : '');
      return `<div class="callout callout-${type}"><div class="callout-body">${content}</div></div>\n`;
    },
  },
});

@Component({
  selector: 'lfx-markdown-renderer',
  templateUrl: './markdown-renderer.component.html',
  styleUrl: './markdown-renderer.component.css',
})
export class MarkdownRendererComponent {
  private readonly sanitizer = inject(DomSanitizer);

  public readonly content = input<string>('');

  protected readonly renderedHtml = computed(() => {
    const raw = this.content();
    if (!raw) return '';
    const html = marked.parse(raw, { async: false }) as string;
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  });
}
