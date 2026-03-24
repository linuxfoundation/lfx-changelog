// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { PublicLayoutPage } from '../../pages/public-layout.page.js';
import { RoadmapBoardPage } from '../../pages/roadmap-board.page.js';

test.describe('Roadmap Board', () => {
  let roadmapPage: RoadmapBoardPage;
  let layoutPage: PublicLayoutPage;

  test.beforeEach(async ({ page }) => {
    roadmapPage = new RoadmapBoardPage(page);
    layoutPage = new PublicLayoutPage(page);
    await roadmapPage.goto();
  });

  test.describe('page layout', () => {
    test('should display the heading', async () => {
      await expect(roadmapPage.heading).toBeVisible();
      await expect(roadmapPage.heading).toContainText('Product Roadmap');
    });

    test('should display the header with logo', async () => {
      await expect(layoutPage.header).toBeVisible();
      await expect(layoutPage.logo).toBeVisible();
    });

    test('should display the kanban board after loading', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
    });

    test('should display the synced from Jira label', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      await expect(roadmapPage.syncedLabel).toBeVisible();
      await expect(roadmapPage.syncedLabel).toContainText('Synced from Jira');
    });

    test('should display total ideas count', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      await expect(roadmapPage.totalIdeas).toBeVisible();
      await expect(roadmapPage.totalIdeas).toContainText('ideas');
    });
  });

  test.describe('columns', () => {
    test('should display 3 active columns by default', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      await expect(roadmapPage.getColumn('Now')).toBeVisible();
      await expect(roadmapPage.getColumn('Next')).toBeVisible();
      await expect(roadmapPage.getColumn('Later')).toBeVisible();
    });

    test('should not display completed columns by default', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      await expect(roadmapPage.getColumn('Done')).not.toBeVisible();
      await expect(roadmapPage.getColumn("Won't do")).not.toBeVisible();
    });

    test('should display column names and counts', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      for (const col of ['Now', 'Next', 'Later']) {
        const column = roadmapPage.getColumn(col);
        await expect(column.locator('[data-testid="roadmap-column-name"]')).toContainText(col);
        await expect(column.locator('[data-testid="roadmap-column-count"]')).toBeVisible();
      }
    });

    test('should display idea cards inside columns', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      const cards = roadmapPage.getCards();
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display card summary text', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      const firstCard = roadmapPage.getCards().first();
      const summary = firstCard.locator('[data-testid="roadmap-card-summary"]');
      await expect(summary).toBeVisible();
      const text = await summary.textContent();
      expect(text!.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe('show/hide completed', () => {
    test('should display the toggle completed button', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      await expect(roadmapPage.toggleCompleted).toBeVisible();
      await expect(roadmapPage.toggleCompleted).toContainText('Show completed');
    });

    test('should show completed columns when toggled', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      await roadmapPage.toggleCompleted.scrollIntoViewIfNeeded();
      await roadmapPage.toggleCompleted.click({ force: true });

      await expect(roadmapPage.getColumn('Done')).toBeVisible({ timeout: 15_000 });
      await expect(roadmapPage.getColumn("Won't do")).toBeVisible();
      await expect(roadmapPage.toggleCompleted).toContainText('Hide completed');
    });

    test('should hide completed columns when toggled back', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      // Show
      await roadmapPage.toggleCompleted.scrollIntoViewIfNeeded();
      await roadmapPage.toggleCompleted.click({ force: true });
      await expect(roadmapPage.getColumn('Done')).toBeVisible({ timeout: 15_000 });

      // Hide
      await roadmapPage.toggleCompleted.scrollIntoViewIfNeeded();
      await roadmapPage.toggleCompleted.click({ force: true });
      await expect(roadmapPage.getColumn('Done')).not.toBeVisible();
      await expect(roadmapPage.getColumn("Won't do")).not.toBeVisible();
      await expect(roadmapPage.toggleCompleted).toContainText('Show completed');
    });
  });

  test.describe('team filtering', () => {
    test('should display team filter pills', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      await expect(roadmapPage.teamFilters).toBeVisible();
    });

    test('should filter ideas when clicking a team pill', async ({ page }) => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const pills = page.locator('[data-testid^="roadmap-team-pill-"]');
      const pillCount = await pills.count();
      if (pillCount === 0) {
        test.skip();
        return;
      }

      const initialCardCount = await roadmapPage.getCards().count();
      await pills.first().click();

      // Wait for reload
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      // Clear button should appear
      await expect(roadmapPage.teamClear).toBeVisible();

      // Card count should change (or stay same if all match)
      const filteredCardCount = await roadmapPage.getCards().count();
      expect(filteredCardCount).toBeLessThanOrEqual(initialCardCount);
    });

    test('should show clear button when a team is selected', async ({ page }) => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const pills = page.locator('[data-testid^="roadmap-team-pill-"]');
      if ((await pills.count()) === 0) {
        test.skip();
        return;
      }

      await pills.first().click();
      await expect(roadmapPage.teamClear).toBeVisible();
    });

    test('should clear filter when clicking clear button', async ({ page }) => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const pills = page.locator('[data-testid^="roadmap-team-pill-"]');
      if ((await pills.count()) === 0) {
        test.skip();
        return;
      }

      const initialCount = await roadmapPage.getCards().count();
      await pills.first().click();
      await expect(roadmapPage.teamClear).toBeVisible();

      await roadmapPage.teamClear.click();
      await expect(roadmapPage.teamClear).not.toBeVisible();

      // Should restore original count
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });
      const restoredCount = await roadmapPage.getCards().count();
      expect(restoredCount).toBe(initialCount);
    });

    test('should deselect team when clicking the same pill again', async ({ page }) => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const pills = page.locator('[data-testid^="roadmap-team-pill-"]');
      if ((await pills.count()) === 0) {
        test.skip();
        return;
      }

      // Click to select
      await pills.first().click();
      await expect(roadmapPage.teamClear).toBeVisible();

      // Click same pill again to deselect
      await pills.first().click();
      await expect(roadmapPage.teamClear).not.toBeVisible();
    });
  });

  test.describe('detail panel', () => {
    test('should open detail panel when clicking a card', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const firstCard = roadmapPage.getCards().first();
      await firstCard.click();

      await expect(roadmapPage.detailPanel).toBeVisible({ timeout: 10_000 });
    });

    test('should display idea summary in detail panel', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const firstCard = roadmapPage.getCards().first();
      await firstCard.click();

      await expect(roadmapPage.detailSummary).toBeVisible({ timeout: 10_000 });
      const text = await roadmapPage.detailSummary.textContent();
      expect(text!.trim().length).toBeGreaterThan(0);
    });

    test('should display roadmap column badge and jira key', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const firstCard = roadmapPage.getCards().first();
      await firstCard.click();

      await expect(roadmapPage.detailColumn).toBeVisible({ timeout: 10_000 });
      await expect(roadmapPage.detailKey).toBeVisible();
      await expect(roadmapPage.detailKey).toContainText(/^LFX-\d+$/);
    });

    test('should display comments section', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const firstCard = roadmapPage.getCards().first();
      await firstCard.click();

      await expect(roadmapPage.detailComments).toBeVisible({ timeout: 10_000 });
      await expect(roadmapPage.detailComments).toContainText('Comments');
    });

    test('should close detail panel when clicking close button', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const firstCard = roadmapPage.getCards().first();
      await firstCard.click();
      await expect(roadmapPage.detailPanel).toBeVisible({ timeout: 10_000 });

      await roadmapPage.detailClose.click();
      await expect(roadmapPage.detailPanel).not.toBeVisible();
    });

    test('should close detail panel when clicking backdrop', async () => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const firstCard = roadmapPage.getCards().first();
      await firstCard.click();
      await expect(roadmapPage.detailPanel).toBeVisible({ timeout: 10_000 });

      // Click the backdrop (left edge, outside the panel)
      await roadmapPage.detailBackdrop.click({ position: { x: 10, y: 300 } });
      await expect(roadmapPage.detailPanel).not.toBeVisible();
    });

    test('should display View in Jira link', async ({ page }) => {
      await expect(roadmapPage.kanban).toBeVisible({ timeout: 15_000 });

      const firstCard = roadmapPage.getCards().first();
      await firstCard.click();
      await expect(roadmapPage.detailSummary).toBeVisible({ timeout: 10_000 });

      const jiraLink = page.locator('a:has-text("View in Jira")');
      await expect(jiraLink).toBeVisible();
      const href = await jiraLink.getAttribute('href');
      expect(href).toContain('linuxfoundation.atlassian.net/browse/LFX-');
      expect(await jiraLink.getAttribute('target')).toBe('_blank');
    });
  });
});
