// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class RoadmapBoardPage {
  public readonly board: Locator;
  public readonly heading: Locator;
  public readonly totalIdeas: Locator;
  public readonly syncedLabel: Locator;
  public readonly teamFilters: Locator;
  public readonly teamClear: Locator;
  public readonly loading: Locator;
  public readonly kanban: Locator;
  public readonly toggleCompleted: Locator;
  public readonly detailBackdrop: Locator;
  public readonly detailPanel: Locator;
  public readonly detailClose: Locator;
  public readonly detailLoading: Locator;
  public readonly detailSummary: Locator;
  public readonly detailColumn: Locator;
  public readonly detailKey: Locator;
  public readonly detailDescription: Locator;
  public readonly detailComments: Locator;
  public readonly detailNotFound: Locator;

  public constructor(public readonly page: Page) {
    this.board = page.locator('[data-testid="roadmap-board"]');
    this.heading = page.locator('[data-testid="roadmap-heading"]');
    this.totalIdeas = page.locator('[data-testid="roadmap-total-ideas"]');
    this.syncedLabel = page.locator('[data-testid="roadmap-synced-label"]');
    this.teamFilters = page.locator('[data-testid="roadmap-team-filters"]');
    this.teamClear = page.locator('[data-testid="roadmap-team-clear"]');
    this.loading = page.locator('[data-testid="roadmap-loading"]');
    this.kanban = page.locator('[data-testid="roadmap-kanban"]');
    this.toggleCompleted = page.locator('[data-testid="roadmap-toggle-completed"]');
    this.detailBackdrop = page.locator('[data-testid="roadmap-detail-backdrop"]');
    this.detailPanel = page.locator('[data-testid="roadmap-detail-panel"]');
    this.detailClose = page.locator('[data-testid="roadmap-detail-close"]');
    this.detailLoading = page.locator('[data-testid="roadmap-detail-loading"]');
    this.detailSummary = page.locator('[data-testid="roadmap-detail-summary"]');
    this.detailColumn = page.locator('[data-testid="roadmap-detail-column"]');
    this.detailKey = page.locator('[data-testid="roadmap-detail-key"]');
    this.detailDescription = page.locator('[data-testid="roadmap-detail-description"]');
    this.detailComments = page.locator('[data-testid="roadmap-detail-comments"]');
    this.detailNotFound = page.locator('[data-testid="roadmap-detail-not-found"]');
  }

  public async goto() {
    await this.page.goto('/roadmap', { waitUntil: 'networkidle' });
  }

  public getColumn(name: string): Locator {
    return this.page.locator(`[data-testid="roadmap-column-${name}"]`);
  }

  public getColumnCount(name: string): Locator {
    return this.getColumn(name).locator('[data-testid="roadmap-column-count"]');
  }

  public getColumnEmpty(name: string): Locator {
    return this.getColumn(name).locator('[data-testid="roadmap-column-empty"]');
  }

  public getTeamPill(team: string): Locator {
    return this.page.locator(`[data-testid="roadmap-team-pill-${team}"]`);
  }

  public getCard(jiraKey: string): Locator {
    return this.page.locator(`[data-testid="roadmap-card-${jiraKey}"]`);
  }

  public getCards(): Locator {
    return this.page.locator('[data-testid^="roadmap-card-"]');
  }

  public getColumns(): Locator {
    return this.page.locator('[data-testid^="roadmap-column-"]').filter({ hasNot: this.page.locator('[data-testid^="roadmap-column-"]') });
  }
}
