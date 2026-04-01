// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export const RuntimeConfigSchema = z
  .object({
    dataDogRumClientId: z.string(),
    dataDogRumApplicationId: z.string(),
    baseUrl: z.string(),
  })
  .openapi('RuntimeConfig');

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
