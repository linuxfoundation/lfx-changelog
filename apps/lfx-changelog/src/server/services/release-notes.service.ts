// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AI_MODEL } from '../constants/ai.constants';
import { AiServiceError } from '../errors';

import type { PendingChange } from '@lfx-changelog/shared';

export class ReleaseNotesService {
  public async generate(repo: string, newTag: string, latestTag: string, pending: PendingChange[]): Promise<string> {
    const apiKey = process.env['LITELLM_API_KEY'];
    const apiUrl = process.env['AI_API_URL'];
    if (!apiKey || !apiUrl) {
      throw new AiServiceError('LiteLLM is not configured', { operation: 'generateReleaseNotes' });
    }

    const prList = pending.map((pr) => `- #${pr.number} ${pr.title} (@${pr.author})`).join('\n');
    const prompt =
      `Generate GitHub release notes for ${repo} release ${newTag}.\n\n` +
      `The following PRs have been merged to main since ${latestTag}:\n\n` +
      `${prList}\n\n` +
      'Requirements:\n' +
      '- Open with a one-sentence summary of what this release delivers\n' +
      '- Group PRs by conventional-commit type prefix ' +
      '(feat→Features, fix→Bug Fixes, perf→Performance, refactor→Refactoring, ' +
      'docs→Documentation, test→Tests, build→Build, ci→CI, style→Style, ' +
      'revert→Reverts, no prefix→Other)\n' +
      '- Strip the type(scope): prefix from each title, show only the cleaned description\n' +
      "- One bullet per PR: '- #<number> <cleaned title> (@<author>)'\n" +
      '- Sort PRs within each section by PR number ascending\n' +
      '- Omit sections with no PRs\n' +
      '- GitHub-flavored Markdown, concise and professional\n' +
      '- No preamble or meta-commentary - output only the release notes body';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new AiServiceError(`LiteLLM notes request failed: ${response.status} ${body}`, { operation: 'generateReleaseNotes' });
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const notes = data.choices?.[0]?.message?.content?.trim();
    if (!notes) {
      throw new AiServiceError('LiteLLM returned empty release notes', { operation: 'generateReleaseNotes' });
    }
    return notes;
  }
}

export const releaseNotesService = new ReleaseNotesService();
