// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ProductRepository } from './github.interface.js';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  faIcon: string;
  githubInstallationId: number | null;
  createdAt: string;
  updatedAt: string;
  repositories?: ProductRepository[];
}
