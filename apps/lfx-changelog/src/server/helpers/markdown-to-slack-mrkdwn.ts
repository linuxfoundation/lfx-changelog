// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Escape characters that Slack treats as delimiters inside `<url|label>` */
function escapeSlackLink(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;');
}

/** Build a Slack link, falling back to the URL as label when text is empty */
function slackLink(url: string, label: string): string {
  const safeUrl = escapeSlackLink(url.trim());
  const safeLabel = label.trim() ? escapeSlackLink(label) : safeUrl;
  return `<${safeUrl}|${safeLabel}>`;
}

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
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => slackLink(url, alt));

  // ── 3. Links ────────────────────────────────────────────────────────────
  text = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_, label, url) => slackLink(url, label));

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

/**
 * Truncate Slack mrkdwn to `maxLen` characters without splitting tokens.
 *
 * Tracks open delimiters (`<…>`, `*…*`, `_…_`, `~…~`, `` `…` ``, `` ```…``` ``)
 * and backs up to before the most recent unclosed token if the limit falls inside one.
 */
export function truncateSlackMrkdwn(mrkdwn: string, maxLen: number): string {
  if (mrkdwn.length <= maxLen) return mrkdwn;

  const suffix = '...';
  const budget = maxLen - suffix.length;
  if (budget <= 0) return suffix.slice(0, maxLen);

  // Position of the most recent safe cut point (outside any open token)
  let safeCut = 0;
  let i = 0;

  while (i < budget) {
    const ch = mrkdwn[i];

    // Fenced code block ``` ... ```
    if (ch === '`' && mrkdwn.slice(i, i + 3) === '```') {
      const closeIdx = mrkdwn.indexOf('```', i + 3);
      if (closeIdx === -1 || closeIdx + 3 > budget) break; // unclosed or exceeds budget
      i = closeIdx + 3;
      safeCut = i;
      continue;
    }

    // Inline code ` ... `
    if (ch === '`') {
      const closeIdx = mrkdwn.indexOf('`', i + 1);
      if (closeIdx === -1 || closeIdx + 1 > budget) break;
      i = closeIdx + 1;
      safeCut = i;
      continue;
    }

    // Slack link <url|label>
    if (ch === '<') {
      const closeIdx = mrkdwn.indexOf('>', i + 1);
      if (closeIdx === -1 || closeIdx + 1 > budget) break;
      i = closeIdx + 1;
      safeCut = i;
      continue;
    }

    // Paired formatting: *bold*, _italic_, ~strike~
    if ((ch === '*' || ch === '_' || ch === '~') && i + 1 < mrkdwn.length && mrkdwn[i + 1] !== ch) {
      const closeIdx = mrkdwn.indexOf(ch, i + 1);
      if (closeIdx === -1 || closeIdx + 1 > budget) break;
      i = closeIdx + 1;
      safeCut = i;
      continue;
    }

    i++;
    safeCut = i;
  }

  return mrkdwn.slice(0, safeCut).trimEnd() + suffix;
}
