// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ROADMAP_ACTIVE_COLUMNS } from '@lfx-changelog/shared';
import { expect, test } from '@playwright/test';
import { createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Public Roadmap API', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    api = await createUnauthenticatedContext(baseURL);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test.describe('GET /public/api/roadmap', () => {
    test('should return 200 with correct response shape', async () => {
      const res = await api.get('/public/api/roadmap');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.columns).toBeDefined();
      expect(Array.isArray(body.data.teams)).toBe(true);
      expect(typeof body.data.lastFetchedAt).toBe('string');
    });

    test('should return active columns by default', async () => {
      const res = await api.get('/public/api/roadmap');
      const body = await res.json();
      const columnNames = Object.keys(body.data.columns);

      for (const col of ROADMAP_ACTIVE_COLUMNS) {
        expect(columnNames).toContain(col);
      }
      expect(columnNames).not.toContain('Done');
      expect(columnNames).not.toContain("Won't do");
    });

    test('should include completed columns when includeCompleted=true', async () => {
      const res = await api.get('/public/api/roadmap?includeCompleted=true');
      expect(res.status()).toBe(200);

      const body = await res.json();
      const columnNames = Object.keys(body.data.columns);

      expect(columnNames).toContain('Done');
      expect(columnNames).toContain("Won't do");
    });

    test('should return ideas with correct shape in each column', async () => {
      const res = await api.get('/public/api/roadmap');
      const body = await res.json();

      for (const [, ideas] of Object.entries(body.data.columns)) {
        for (const idea of ideas as any[]) {
          expect(idea.jiraKey).toMatch(/^LFX-\d+$/);
          expect(typeof idea.summary).toBe('string');
          expect(typeof idea.roadmapColumn).toBe('string');
          expect(Array.isArray(idea.teams)).toBe(true);
          expect(Array.isArray(idea.goals)).toBe(true);
          expect(typeof idea.status).toBe('string');
          expect(typeof idea.votes).toBe('number');
          expect(idea.jiraUrl).toContain('linuxfoundation.atlassian.net/browse/LFX-');
        }
      }
    });

    test('should return sorted teams array', async () => {
      const res = await api.get('/public/api/roadmap');
      const body = await res.json();
      const teams: string[] = body.data.teams;

      if (teams.length > 1) {
        const sorted = [...teams].sort();
        expect(teams).toEqual(sorted);
      }
    });

    test('should filter ideas by team when team param is provided', async () => {
      // First get the board to find a valid team
      const boardRes = await api.get('/public/api/roadmap');
      const boardBody = await boardRes.json();
      const teams: string[] = boardBody.data.teams;

      if (teams.length === 0) {
        test.skip();
        return;
      }

      const team = teams[0];
      const filteredRes = await api.get(`/public/api/roadmap?team=${encodeURIComponent(team!)}`);
      expect(filteredRes.status()).toBe(200);

      const filteredBody = await filteredRes.json();
      for (const [, ideas] of Object.entries(filteredBody.data.columns)) {
        for (const idea of ideas as any[]) {
          expect(idea.teams).toContain(team);
        }
      }
    });

    test('should include cache headers', async () => {
      const res = await api.get('/public/api/roadmap');
      const cacheControl = res.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toContain('max-age=300');
      expect(cacheControl).toContain('stale-while-revalidate=60');
    });

    test('should redact reporter/creator/assignee names for privacy', async () => {
      const res = await api.get('/public/api/roadmap');
      const body = await res.json();

      for (const [, ideas] of Object.entries(body.data.columns)) {
        for (const idea of ideas as any[]) {
          if (idea.reporter?.name) {
            // Redacted names should be "First L." format or single word
            expect(idea.reporter.name).toMatch(/^[\w-]+( \w\.)?$/);
          }
        }
      }
    });
  });

  test.describe('GET /public/api/roadmap/:jiraKey', () => {
    test('should return an idea for a valid key that exists on the board', async () => {
      // Get a valid key from the board first
      const boardRes = await api.get('/public/api/roadmap');
      const boardBody = await boardRes.json();
      let validKey: string | null = null;

      for (const ideas of Object.values(boardBody.data.columns)) {
        if ((ideas as any[]).length > 0) {
          validKey = (ideas as any[])[0].jiraKey;
          break;
        }
      }

      if (!validKey) {
        test.skip();
        return;
      }

      const res = await api.get(`/public/api/roadmap/${validKey}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.jiraKey).toBe(validKey);
      expect(body.data.summary).toBeDefined();
    });

    test('should return 404 for non-existent valid key', async () => {
      const res = await api.get('/public/api/roadmap/LFX-99999');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Roadmap idea not found');
    });

    test('should return 404 for invalid project key format', async () => {
      const res = await api.get('/public/api/roadmap/INVALID-123');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Roadmap idea not found');
    });

    test('should reject keys from other Jira projects', async () => {
      const res = await api.get('/public/api/roadmap/JIRA-100');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('should include cache headers', async () => {
      const res = await api.get('/public/api/roadmap/LFX-1');
      const cacheControl = res.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toContain('max-age=300');
      expect(cacheControl).toContain('stale-while-revalidate=60');
    });
  });

  test.describe('GET /public/api/roadmap/:jiraKey/comments', () => {
    test('should return 200 with array for a valid key', async () => {
      // Get a valid key from the board
      const boardRes = await api.get('/public/api/roadmap');
      const boardBody = await boardRes.json();
      let validKey: string | null = null;

      for (const ideas of Object.values(boardBody.data.columns)) {
        if ((ideas as any[]).length > 0) {
          validKey = (ideas as any[])[0].jiraKey;
          break;
        }
      }

      if (!validKey) {
        test.skip();
        return;
      }

      const res = await api.get(`/public/api/roadmap/${validKey}/comments`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should return comment objects with correct shape', async () => {
      const boardRes = await api.get('/public/api/roadmap');
      const boardBody = await boardRes.json();
      let validKey: string | null = null;

      for (const ideas of Object.values(boardBody.data.columns)) {
        if ((ideas as any[]).length > 0) {
          validKey = (ideas as any[])[0].jiraKey;
          break;
        }
      }

      if (!validKey) {
        test.skip();
        return;
      }

      const res = await api.get(`/public/api/roadmap/${validKey}/comments`);
      const body = await res.json();

      for (const comment of body.data) {
        expect(typeof comment.createdAt).toBe('string');
        // author can be null
        if (comment.author) {
          expect(typeof comment.author.name).toBe('string');
        }
      }
    });

    test('should return empty array for invalid key', async () => {
      const res = await api.get('/public/api/roadmap/INVALID-123/comments');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    test('should include shorter cache headers than board endpoint', async () => {
      const res = await api.get('/public/api/roadmap/LFX-1/comments');
      const cacheControl = res.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toContain('max-age=120');
      expect(cacheControl).toContain('stale-while-revalidate=30');
    });
  });

  test.describe('security', () => {
    test('should be accessible without authentication', async () => {
      const res = await api.get('/public/api/roadmap');
      expect(res.status()).not.toBe(401);
      expect(res.status()).not.toBe(403);
    });

    test('should not leak data from non-LFX Jira projects', async () => {
      const res = await api.get('/public/api/roadmap/SECRET-42');
      expect(res.status()).toBe(404);
    });
  });
});
