import type { ChangelogStatus } from '../enums/changelog-status.enum.js';

export interface ChangelogEntry {
  id: string;
  productId: string;
  title: string;
  description: string;
  version: string;
  status: ChangelogStatus;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
