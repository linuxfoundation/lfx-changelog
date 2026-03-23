// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { AdfNode } from '@lfx-changelog/shared';

/**
 * Lightweight Atlassian Document Format (ADF) to HTML converter.
 * Supports the common node types used in Jira Product Discovery descriptions.
 */
@Pipe({ name: 'adfToHtml', standalone: true })
export class AdfToHtmlPipe implements PipeTransform {
  public transform(adf: Record<string, unknown> | null | undefined): string {
    if (!adf || adf['type'] !== 'doc') return '';
    return this.renderNodes((adf['content'] as AdfNode[]) ?? []);
  }

  private renderNodes(nodes: AdfNode[]): string {
    return nodes.map((node) => this.renderNode(node)).join('');
  }

  private renderNode(node: AdfNode): string {
    switch (node.type) {
      case 'paragraph':
        return `<p>${this.renderNodes(node.content ?? [])}</p>`;

      case 'heading': {
        const rawLevel = Number.parseInt(String(node.attrs?.['level'] ?? 3), 10);
        const level = Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 6 ? rawLevel : 3;
        return `<h${level}>${this.renderNodes(node.content ?? [])}</h${level}>`;
      }

      case 'text':
        return this.renderTextWithMarks(node);

      case 'bulletList':
        return `<ul>${this.renderNodes(node.content ?? [])}</ul>`;

      case 'orderedList':
        return `<ol>${this.renderNodes(node.content ?? [])}</ol>`;

      case 'listItem':
        return `<li>${this.renderNodes(node.content ?? [])}</li>`;

      case 'codeBlock': {
        const lang = String(node.attrs?.['language'] ?? '');
        return `<pre><code class="language-${this.escapeHtml(lang)}">${this.renderNodes(node.content ?? [])}</code></pre>`;
      }

      case 'blockquote':
        return `<blockquote>${this.renderNodes(node.content ?? [])}</blockquote>`;

      case 'rule':
        return '<hr />';

      case 'hardBreak':
        return '<br />';

      case 'table':
        return `<table>${this.renderNodes(node.content ?? [])}</table>`;

      case 'tableRow':
        return `<tr>${this.renderNodes(node.content ?? [])}</tr>`;

      case 'tableHeader':
        return `<th>${this.renderNodes(node.content ?? [])}</th>`;

      case 'tableCell':
        return `<td>${this.renderNodes(node.content ?? [])}</td>`;

      case 'mediaGroup':
      case 'mediaSingle':
      case 'media':
        return ''; // Skip media nodes

      default:
        // Fallback: render children or extract text
        if (node.content) {
          return this.renderNodes(node.content);
        }
        if (node.text) {
          return this.escapeHtml(node.text);
        }
        return '';
    }
  }

  private renderTextWithMarks(node: AdfNode): string {
    let text = this.escapeHtml(node.text ?? '');
    if (!node.marks) return text;

    for (const mark of node.marks) {
      switch (mark.type) {
        case 'strong':
          text = `<strong>${text}</strong>`;
          break;
        case 'em':
          text = `<em>${text}</em>`;
          break;
        case 'code':
          text = `<code>${text}</code>`;
          break;
        case 'underline':
          text = `<u>${text}</u>`;
          break;
        case 'strike':
          text = `<s>${text}</s>`;
          break;
        case 'link': {
          const rawHref = String(mark.attrs?.['href'] ?? '');
          if (/^https?:\/\/|^mailto:/i.test(rawHref)) {
            const href = this.escapeHtml(rawHref);
            text = `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          }
          break;
        }
      }
    }
    return text;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
