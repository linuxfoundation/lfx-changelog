import { Component, computed, inject, input, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

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
