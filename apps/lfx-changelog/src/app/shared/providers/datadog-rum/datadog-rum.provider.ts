// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { inject, provideAppInitializer, TransferState } from '@angular/core';
import { environment } from '@environments/environment';

import { getRuntimeConfig } from '../runtime-config/runtime-config.provider';

export function provideDataDogRum() {
  return provideAppInitializer(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const transferState = inject(TransferState);
    const config = getRuntimeConfig(transferState);

    if (!config.dataDogRumClientId || !config.dataDogRumApplicationId) {
      console.warn('DataDog RUM not configured — missing client ID or application ID');
      return;
    }

    const { datadogRum } = await import('@datadog/browser-rum');

    const ddEnv = environment.datadog.env;

    datadogRum.init({
      applicationId: config.dataDogRumApplicationId,
      clientToken: config.dataDogRumClientId,
      site: environment.datadog.site,
      service: environment.datadog.service,
      env: ddEnv,
      sessionSampleRate: ddEnv ? 100 : 0,
      sessionReplaySampleRate: ddEnv ? 100 : 0,
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      allowedTracingUrls: [environment.apiUrl],
    });
  });
}
