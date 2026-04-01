// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { inject, makeStateKey, provideAppInitializer, REQUEST_CONTEXT, TransferState } from '@angular/core';

import type { RuntimeConfig } from '@lfx-changelog/shared';

const RUNTIME_CONFIG_KEY = makeStateKey<RuntimeConfig>('runtimeConfig');

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  dataDogRumClientId: '',
  dataDogRumApplicationId: '',
  baseUrl: '',
};

export function getRuntimeConfig(transferState: TransferState): RuntimeConfig {
  return transferState.get(RUNTIME_CONFIG_KEY, DEFAULT_RUNTIME_CONFIG);
}

export function provideRuntimeConfig() {
  return provideAppInitializer(() => {
    const transferState = inject(TransferState);
    const reqContext = inject(REQUEST_CONTEXT, { optional: true }) as { runtimeConfig?: RuntimeConfig } | null;

    if (reqContext?.runtimeConfig) {
      transferState.set(RUNTIME_CONFIG_KEY, reqContext.runtimeConfig);
    }
  });
}
