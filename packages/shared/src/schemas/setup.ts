// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);
