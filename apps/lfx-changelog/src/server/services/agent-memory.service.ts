// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AgentMemoryDataSchema, EMPTY_AGENT_MEMORY, MAX_CORRECTIONS, MAX_QUALITY_SCORES, ProgressLogEntrySchema } from '@lfx-changelog/shared';
import { z } from 'zod';

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';

import type { AgentMemoryData, CorrectionEntry, ProgressLogEntry, QualityScoreEntry } from '@lfx-changelog/shared';

export class AgentMemoryService {
  /**
   * Returns the memory data for a product, or the empty default if none exists.
   */
  public async getMemoryForProduct(productId: string): Promise<AgentMemoryData> {
    const prisma = getPrismaClient();
    const record = await prisma.agentMemory.findUnique({ where: { productId } });
    if (!record) return structuredClone(EMPTY_AGENT_MEMORY);

    const parseResult = AgentMemoryDataSchema.safeParse(record.memory);
    if (!parseResult.success) {
      serverLogger.warn({ productId, errors: parseResult.error.issues }, 'Invalid agent memory JSON — returning default');
      return structuredClone(EMPTY_AGENT_MEMORY);
    }
    return parseResult.data;
  }

  /**
   * After an automated changelog is published, captures the diff between the
   * original agent-generated draft and the published (admin-edited) version.
   */
  public async captureCorrection(changelogId: string, productId: string): Promise<void> {
    const prisma = getPrismaClient();

    // Find the agent job linked to this changelog
    const agentJob = await prisma.agentJob.findFirst({
      where: { changelogId, productId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      select: { id: true, progressLog: true },
    });

    if (!agentJob) {
      serverLogger.debug({ changelogId, productId }, 'No completed agent job found for changelog — skipping correction capture');
      return;
    }

    // Extract the original draft from the progress log
    const parseResult = z.array(ProgressLogEntrySchema).safeParse(agentJob.progressLog);
    if (!parseResult.success) {
      serverLogger.debug({ changelogId, jobId: agentJob.id }, 'Could not parse progress log');
      return;
    }
    const originalDraft = this.extractOriginalDraft(parseResult.data);
    if (!originalDraft) {
      serverLogger.debug({ changelogId, jobId: agentJob.id }, 'Could not extract original draft from progress log');
      return;
    }

    // Fetch the published version
    const published = await prisma.changelogEntry.findUnique({
      where: { id: changelogId },
      select: { title: true, description: true },
    });
    if (!published) return;

    // Check if anything actually changed
    if (originalDraft.title === published.title && originalDraft.description === published.description) {
      serverLogger.debug({ changelogId }, 'No corrections detected — original matches published');

      // Still record wasEdited = false for quality tracking, only persist if a score was updated
      const memory = await this.getMemoryForProduct(productId);
      const hadScore = this.markLatestScoreUnedited(memory, agentJob.id);
      if (hadScore) {
        await this.saveMemory(productId, memory);
      }
      return;
    }

    const diffSummary = this.generateDiffSummary(originalDraft, published);

    const correction: CorrectionEntry = {
      capturedAt: new Date().toISOString(),
      changelogId,
      originalTitle: originalDraft.title,
      publishedTitle: published.title,
      originalDescription: originalDraft.description,
      publishedDescription: published.description,
      diffSummary,
    };

    const memory = await this.getMemoryForProduct(productId);
    memory.recentCorrections.push(correction);
    if (memory.recentCorrections.length > MAX_CORRECTIONS) {
      memory.recentCorrections = memory.recentCorrections.slice(-MAX_CORRECTIONS);
    }
    memory.lastAnalyzedAt = new Date().toISOString();

    // Mark the latest quality score for this job as edited
    this.markLatestScoreEdited(memory, agentJob.id);

    await this.saveMemory(productId, memory);
    serverLogger.info({ changelogId, productId, diffSummary }, 'Captured correction in agent memory');
  }

  /**
   * Records critic quality scores from an agent run.
   */
  public async recordQualityScores(
    jobId: string,
    productId: string,
    scores: { accuracy: number; clarity: number; tone: number; completeness: number; overall: number }
  ): Promise<void> {
    const memory = await this.getMemoryForProduct(productId);

    const entry: QualityScoreEntry = {
      recordedAt: new Date().toISOString(),
      jobId,
      accuracy: scores.accuracy,
      clarity: scores.clarity,
      tone: scores.tone,
      completeness: scores.completeness,
      overall: scores.overall,
      wasEdited: false, // Updated later when the entry is published
    };

    memory.qualityScores.push(entry);
    if (memory.qualityScores.length > MAX_QUALITY_SCORES) {
      memory.qualityScores = memory.qualityScores.slice(-MAX_QUALITY_SCORES);
    }

    await this.saveMemory(productId, memory);
    serverLogger.info({ jobId, productId, overall: scores.overall }, 'Recorded quality scores in agent memory');
  }

  /**
   * Formats memory data into a markdown context string for prompt injection.
   * Returns empty string if memory is empty.
   */
  public formatMemoryContext(memory: AgentMemoryData): string {
    const sections: string[] = [];

    // Style preferences
    const prefs = memory.stylePreferences;
    const prefLines: string[] = [];
    if (prefs.headingStyle) prefLines.push(`- Heading style: ${prefs.headingStyle}`);
    if (prefs.bulletFormat) prefLines.push(`- Bullet format: ${prefs.bulletFormat}`);
    if (prefs.tone) prefLines.push(`- Tone: ${prefs.tone}`);
    if (prefs.detailLevel) prefLines.push(`- Detail level: ${prefs.detailLevel}`);
    if (prefs.wordCountRange) prefLines.push(`- Preferred word count: ${prefs.wordCountRange.min}-${prefs.wordCountRange.max}`);
    if (prefs.customInstructions) prefLines.push(`- Custom instructions: ${prefs.customInstructions}`);
    if (prefLines.length > 0) {
      sections.push(`### Style Preferences\n${prefLines.join('\n')}`);
    }

    // Recent corrections
    if (memory.recentCorrections.length > 0) {
      const corrLines = memory.recentCorrections.slice(-5).map((c) => {
        const parts = [`- **${c.diffSummary}**`];
        if (c.originalTitle !== c.publishedTitle) {
          parts.push(`  - Title changed: "${c.originalTitle}" → "${c.publishedTitle}"`);
        }
        return parts.join('\n');
      });
      sections.push(`### Recent Admin Corrections\n${corrLines.join('\n')}`);
    }

    // Quality score trends
    if (memory.qualityScores.length > 0) {
      const recent = memory.qualityScores.slice(-5);
      const avgOverall = recent.reduce((sum, s) => sum + s.overall, 0) / recent.length;
      const editRate = recent.filter((s) => s.wasEdited).length / recent.length;

      const trendLines = [
        `- Average overall score (last ${recent.length}): ${avgOverall.toFixed(1)}/5.0`,
        `- Admin edit rate: ${(editRate * 100).toFixed(0)}%`,
      ];

      const weakAreas = this.identifyWeakAreas(recent);
      if (weakAreas.length > 0) {
        trendLines.push(`- Areas needing improvement: ${weakAreas.join(', ')}`);
      }

      sections.push(`### Quality Trends\n${trendLines.join('\n')}`);
    }

    if (sections.length === 0) return '';

    return `## Memory & Learned Preferences\n\n${sections.join('\n\n')}`;
  }

  // ── Private helpers ────────────────────────────

  private extractOriginalDraft(progressLog: ProgressLogEntry[]): { title: string; description: string } | null {
    // Look for create_changelog_draft or update_changelog_draft tool calls with args
    for (let i = progressLog.length - 1; i >= 0; i--) {
      const entry = progressLog[i];
      if (entry.type === 'tool_call' && (entry.tool === 'create_changelog_draft' || entry.tool === 'update_changelog_draft') && entry.args) {
        const args = entry.args as Record<string, unknown>;
        const title = args['title'] as string | undefined;
        const description = args['description'] as string | undefined;
        if (title && description) {
          return { title, description };
        }
      }
    }
    return null;
  }

  private generateDiffSummary(
    original: { title: string; description: string },
    published: { title: string; description: string }
  ): string {
    const parts: string[] = [];

    if (original.title !== published.title) {
      parts.push('Title was changed');
    }

    const origWordCount = original.description.split(/\s+/).length;
    const pubWordCount = published.description.split(/\s+/).length;
    const wordDiff = pubWordCount - origWordCount;
    if (Math.abs(wordDiff) > 5) {
      parts.push(`Description ${wordDiff > 0 ? 'expanded' : 'condensed'} by ~${Math.abs(wordDiff)} words`);
    }

    const origHeadings = (original.description.match(/^#{1,3}\s+.+$/gm) || []).map((h) => h.trim());
    const pubHeadings = (published.description.match(/^#{1,3}\s+.+$/gm) || []).map((h) => h.trim());
    const addedHeadings = pubHeadings.filter((h) => !origHeadings.includes(h));
    const removedHeadings = origHeadings.filter((h) => !pubHeadings.includes(h));
    if (addedHeadings.length > 0) parts.push(`Headings added: ${addedHeadings.join(', ')}`);
    if (removedHeadings.length > 0) parts.push(`Headings removed: ${removedHeadings.join(', ')}`);

    if (parts.length === 0) parts.push('Minor text edits');

    return parts.join('. ') + '.';
  }

  private async saveMemory(productId: string, memory: AgentMemoryData): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.agentMemory.upsert({
      where: { productId },
      create: { productId, memory: memory as object, version: 1 },
      update: { memory: memory as object, version: { increment: 1 } },
    });
  }

  private markLatestScoreEdited(memory: AgentMemoryData, jobId: string): boolean {
    for (let i = memory.qualityScores.length - 1; i >= 0; i--) {
      if (memory.qualityScores[i].jobId === jobId) {
        memory.qualityScores[i].wasEdited = true;
        return true;
      }
    }
    return false;
  }

  private markLatestScoreUnedited(memory: AgentMemoryData, jobId: string): boolean {
    for (let i = memory.qualityScores.length - 1; i >= 0; i--) {
      if (memory.qualityScores[i].jobId === jobId) {
        memory.qualityScores[i].wasEdited = false;
        return true;
      }
    }
    return false;
  }

  private identifyWeakAreas(scores: QualityScoreEntry[]): string[] {
    const areas: { name: string; key: keyof QualityScoreEntry }[] = [
      { name: 'accuracy', key: 'accuracy' },
      { name: 'clarity', key: 'clarity' },
      { name: 'tone', key: 'tone' },
      { name: 'completeness', key: 'completeness' },
    ];

    const weak: string[] = [];
    for (const area of areas) {
      const avg = scores.reduce((sum, s) => sum + (s[area.key] as number), 0) / scores.length;
      if (avg < 3.5) weak.push(area.name);
    }
    return weak;
  }
}
