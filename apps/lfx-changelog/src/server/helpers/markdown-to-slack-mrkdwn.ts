// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Convert standard Markdown to Slack mrkdwn format.
 *
 * Handles: bold, italic, bold+italic, strikethrough, headings, links, images,
 * code blocks, inline code, lists, horizontal rules, and blank-line collapsing.
 */
export function markdownToSlackMrkdwn(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // ── 1. Protect code blocks and inline code ──────────────────────────────
  const placeholders: string[] = [];
  const placeholder = (content: string): string => {
    const index = placeholders.length;
    placeholders.push(content);
    return `%%CODEBLOCK_${index}%%`;
  };

  // Fenced code blocks (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    // Strip language identifier: ```js\n → ```\n
    const stripped = match.replace(/^```\w*\n/, '```\n');
    return placeholder(stripped);
  });

  // Inline code (` ... `)
  text = text.replace(/`[^`\n]+`/g, (match) => placeholder(match));

  // ── 2. Images → clickable links ─────────────────────────────────────────
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<$2|$1>');

  // ── 3. Links ────────────────────────────────────────────────────────────
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // ── 4. Bold+italic (***text*** or ___text___) → placeholder ────────────
  // Must be placeholdered before italic runs, otherwise *_text_* gets re-matched
  const boldItalicSlots: string[] = [];
  text = text.replace(/\*{3}(.+?)\*{3}/g, (_, c) => {
    boldItalicSlots.push(`*_${c}_*`);
    return `%%BOLDITALIC_${boldItalicSlots.length - 1}%%`;
  });
  text = text.replace(/_{3}(.+?)_{3}/g, (_, c) => {
    boldItalicSlots.push(`*_${c}_*`);
    return `%%BOLDITALIC_${boldItalicSlots.length - 1}%%`;
  });

  // ── 5. Italic (*text*) — BEFORE bold so it won't re-match converted *bold* ─
  // Lookaround ensures single * is not adjacent to another * (skips **bold**)
  text = text.replace(/(?<!\*)\*(?!\s|\*)(.+?)(?<!\s|\*)\*(?!\*)/g, '_$1_');

  // ── 6. Bold (**text** or __text__) ──────────────────────────────────────
  text = text.replace(/\*{2}(.+?)\*{2}/g, '*$1*');
  text = text.replace(/_{2}(.+?)_{2}/g, '*$1*');

  // ── 7. Restore bold+italic placeholders ─────────────────────────────────
  text = text.replace(/%%BOLDITALIC_(\d+)%%/g, (_, i) => boldItalicSlots[parseInt(i, 10)]);

  // ── 8. Headings (# ... ) → bold text ───────────────────────────────────
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // ── 9. List markers (* item, - item) → bullet ──────────────────────────
  text = text.replace(/^(\s*)[*-]\s+/gm, '$1• ');

  // ── 10. Strikethrough (~~text~~) ────────────────────────────────────────
  text = text.replace(/~~(.+?)~~/g, '~$1~');

  // ── 11. Horizontal rules (---, ***, ___) → remove ─────────────────────
  text = text.replace(/^[\t ]*[-*_]{3,}[\t ]*$/gm, '');

  // ── 12. Collapse excessive blank lines (3+ → 2) ───────────────────────
  text = text.replace(/\n{3,}/g, '\n\n');

  // ── 13. Restore code placeholders ─────────────────────────────────────
  text = text.replace(/%%CODEBLOCK_(\d+)%%/g, (_, index) => placeholders[parseInt(index, 10)]);

  return text.trim();
}
